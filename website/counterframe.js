import crypto from 'node:crypto';
import {visitorCountry} from './geoMarket.js';
import fs from 'node:fs';
import path from 'node:path';
import {pipeline} from 'node:stream/promises';
import {Transform} from 'node:stream';
import {inspectApk} from './apkMetadata.js';

export const language = value => ['pt','en','es','ru'].includes(String(value || '').split(/[-_]/)[0]) ? String(value).split(/[-_]/)[0] : 'en';
const hash = v => crypto.createHash('sha256').update(String(v)).digest('hex');
const fail = (code, status=400) => Object.assign(new Error(code), {status});
const tokenHash = token => hash(token);
const HEX = /^[a-f0-9]{64}$/i;
const encrypt = value => {
  const key=crypto.createHash('sha256').update(process.env.SESSION_SECRET).digest();
  const iv=crypto.randomBytes(12), cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
  return Buffer.concat([iv,cipher.update(value,'utf8'),cipher.final(),cipher.getAuthTag()]).toString('base64');
};
const decrypt = value => {
  const b=Buffer.from(value,'base64'), key=crypto.createHash('sha256').update(process.env.SESSION_SECRET).digest();
  const d=crypto.createDecipheriv('aes-256-gcm',key,b.subarray(0,12));d.setAuthTag(b.subarray(-16));
  return Buffer.concat([d.update(b.subarray(12,-16)),d.final()]).toString('utf8');
};

export async function initCounterframe(pool) {
  await pool.query(`
    ALTER TABLE users ALTER COLUMN email DROP NOT NULL;
    CREATE TABLE IF NOT EXISTS cf_devices(user_id BIGINT PRIMARY KEY REFERENCES users(id), device_hash TEXT NOT NULL, bound_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), ip TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS cf_sessions(token_hash TEXT PRIMARY KEY,user_id BIGINT NOT NULL REFERENCES users(id),device_hash TEXT NOT NULL,ip TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),expires_at TIMESTAMPTZ NOT NULL,last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE TABLE IF NOT EXISTS cf_device_reset_requests(user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,status TEXT NOT NULL CHECK(status IN ('pending','approved','denied')),requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),reviewed_at TIMESTAMPTZ);
    CREATE TABLE IF NOT EXISTS cf_keys(id BIGSERIAL PRIMARY KEY,payment_id BIGINT UNIQUE REFERENCES checkout_payments(id),buyer_id BIGINT REFERENCES users(id),key_hash TEXT UNIQUE NOT NULL,key_cipher TEXT NOT NULL,days INTEGER NOT NULL,plan TEXT NOT NULL,claimed_by BIGINT REFERENCES users(id),activated_at TIMESTAMPTZ,expires_at TIMESTAMPTZ,revoked_at TIMESTAMPTZ);
    CREATE TABLE IF NOT EXISTS access_audit(id BIGSERIAL PRIMARY KEY,user_id BIGINT REFERENCES users(id),product TEXT NOT NULL,event TEXT NOT NULL,ip TEXT NOT NULL,device_hash TEXT NOT NULL DEFAULT '',language TEXT NOT NULL DEFAULT 'en',country TEXT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    CREATE INDEX IF NOT EXISTS access_audit_user ON access_audit(user_id,created_at DESC);
    CREATE TABLE IF NOT EXISTS cf_bot_users(telegram_id BIGINT PRIMARY KEY,language TEXT NOT NULL);
    CREATE TABLE IF NOT EXISTS cf_notifications(id BIGSERIAL PRIMARY KEY,title TEXT NOT NULL,body TEXT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
    ALTER TABLE cf_notifications ADD COLUMN IF NOT EXISTS texts JSONB;
    ALTER TABLE access_audit ADD COLUMN IF NOT EXISTS device_model TEXT,ADD COLUMN IF NOT EXISTS loader_version TEXT,ADD COLUMN IF NOT EXISTS timezone TEXT;
    ALTER TABLE cf_keys ADD COLUMN IF NOT EXISTS lifetime BOOLEAN NOT NULL DEFAULT FALSE;
    ALTER TABLE cf_keys ADD COLUMN IF NOT EXISTS duration_seconds BIGINT;
  `);
  await pool.query(`WITH applied AS (INSERT INTO app_settings(key,value) VALUES('cf_ios_available_20261111','1') ON CONFLICT(key) DO NOTHING RETURNING key)
    INSERT INTO app_settings(key,value) SELECT k,v FROM (VALUES('cf_ios_status','online'),('cf_ios_message','Counter Flame para iOS disponível.')) x(k,v)
    WHERE EXISTS(SELECT 1 FROM applied) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()`);
}

// Called inside the checkout transaction after the provider confirms payment.
export async function issuePurchaseKey(client,paymentId,payment) {
  const raw='CF-'+crypto.randomBytes(18).toString('hex').toUpperCase();
  const days=payment.plan_lifetime?0:Math.max(1,Number(payment.plan_days||30));
  await client.query(`INSERT INTO cf_keys(payment_id,buyer_id,key_hash,key_cipher,days,plan,lifetime,duration_seconds)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(payment_id) DO NOTHING`,
    [paymentId,payment.user_id,hash(raw),encrypt(raw),days,payment.plan_name||'Counter Flame',Boolean(payment.plan_lifetime),days*86400]);
}

export function registerCounterframe(app,deps) {
  const {pool,requireUser,requireAdmin,verifyPassword,passwordHash,validUsername,validEmail,setting,setSetting}=deps;
  const wrap = fn => async(req,res,next)=>{try {if(!pool)throw fail('unavailable',503);await fn(req,res,next);}catch(e){res.status(e.status||500).json({error:e.status?e.message:'server_error'});}};
  // Coolify terminates TLS. Configure TRUST_PROXY only for the actual proxy hop.
  const ip = req => req.ip || req.socket.remoteAddress || '';
  const device = req => {const id=String(req.headers['x-device-id']||'');if(!HEX.test(id))throw fail('device_required');return hash(id);};
  const audit = async (db,req,user,event) => {
    const country=process.env.CF_GEO_ENABLED==='false'?null:await visitorCountry({headers:{},socket:{remoteAddress:ip(req)}});
    return db.query('INSERT INTO access_audit(user_id,product,event,ip,device_hash,language,country,device_model,loader_version,timezone) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)',[user,'counterframe-android',event,ip(req),hash(req.headers['x-device-id']||''),language(req.headers['accept-language']),country,String(req.headers['x-device-model']||'').slice(0,100),String(req.headers['x-loader-version']||'').slice(0,20),String(req.headers['x-timezone']||'').slice(0,80)]);
  };
  const limits=new Map();
  const rate = req => {const now=Date.now(),k=ip(req),a=limits.get(k);if(a&&a.until>now&&a.count>=15)throw fail('rate_limited',429);if(!a||a.until<now)limits.set(k,{count:1,until:now+60000});else a.count++;if(limits.size>10000)for(const [k,v] of limits)if(v.until<now)limits.delete(k);};
  const transaction = async fn => {const db=await pool.connect();try{await db.query('BEGIN');const result=await fn(db);await db.query('COMMIT');return result;}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}};
  const auth = wrap(async(req,res,next)=>{
    const token=String(req.headers.authorization||'').replace(/^Bearer /,'');
    const {rows}=await pool.query(`SELECT s.*,u.username,u.disabled_at FROM cf_sessions s JOIN users u ON u.id=s.user_id WHERE token_hash=$1 AND expires_at>NOW()`,[tokenHash(token)]);
    const s=rows[0];if(!s||s.disabled_at)throw fail('unauthorized',401);
    if(s.device_hash!==device(req))throw fail('device_mismatch',403);
    if(s.ip!==ip(req))throw fail('ip_changed',401);
    req.cf=s;await pool.query('UPDATE cf_sessions SET last_seen=NOW() WHERE token_hash=$1',[s.token_hash]);next();
  });
  const snapshot = async s => {
    const {rows}=await pool.query('SELECT plan,days,duration_seconds,activated_at,expires_at,lifetime,revoked_at FROM cf_keys WHERE claimed_by=$1 ORDER BY activated_at DESC NULLS LAST,id DESC LIMIT 100',[s.user_id]);
    const active=rows.filter(row=>!row.revoked_at&&row.expires_at&&new Date(row.expires_at)>new Date());
    return {username:s.username,licenses:active,history:rows,expiresAt:active.sort((a,b)=>new Date(b.expires_at)-new Date(a.expires_at))[0]?.expires_at||null,serverTime:Date.now()};
  };
  const activateKey = async(db,keyValue,userId) => {
    const {rows}=await db.query('SELECT * FROM cf_keys WHERE key_hash=$1 FOR UPDATE',[hash(String(keyValue||'').trim().toUpperCase())]);const key=rows[0];
    if(!key||key.revoked_at)throw fail('invalid_key');
    if(key.buyer_id&&String(key.buyer_id)!==String(userId))throw fail('key_owner',403);
    if(key.claimed_by){if(String(key.claimed_by)!==String(userId))throw fail('key_used',409);return;}
    await db.query(`UPDATE cf_keys SET claimed_by=$2,activated_at=NOW(),expires_at=CASE WHEN $4::boolean OR EXISTS(SELECT 1 FROM cf_keys WHERE claimed_by=$2 AND revoked_at IS NULL AND lifetime=TRUE) THEN TIMESTAMPTZ '9999-12-31 23:59:59+00' ELSE GREATEST(NOW(),COALESCE((SELECT MAX(expires_at) FROM cf_keys WHERE claimed_by=$2 AND revoked_at IS NULL),NOW()))+(COALESCE($5::bigint,$3::bigint*86400) * INTERVAL '1 second') END WHERE id=$1`,[key.id,userId,key.days,key.lifetime,key.duration_seconds]);
  };
  const bindSession=async(db,req,u,token)=>{
    const id=device(req);await db.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[u.id]);
    const {rows}=await db.query('SELECT device_hash FROM cf_devices WHERE user_id=$1 FOR UPDATE',[u.id]);
    if(rows[0]&&rows[0].device_hash!==id){
      const approval=await db.query("SELECT status FROM cf_device_reset_requests WHERE user_id=$1 AND status='approved' FOR UPDATE",[u.id]);
      if(!approval.rowCount)throw fail('device_mismatch',403);
      await db.query('UPDATE cf_devices SET device_hash=$2,bound_at=NOW(),ip=$3 WHERE user_id=$1',[u.id,id,ip(req)]);
      await db.query('DELETE FROM cf_device_reset_requests WHERE user_id=$1',[u.id]);
    }
    await db.query('INSERT INTO cf_devices(user_id,device_hash,ip) VALUES($1,$2,$3) ON CONFLICT(user_id) DO NOTHING',[u.id,id,ip(req)]);
    await db.query('DELETE FROM cf_sessions WHERE user_id=$1',[u.id]);
    await db.query("INSERT INTO cf_sessions(token_hash,user_id,device_hash,ip,expires_at) VALUES($1,$2,$3,$4,NOW()+INTERVAL '30 days')",[tokenHash(token),u.id,id,ip(req)]);
  };
  const status = async()=>({availability:await setting('cf_android_status','offline'),safety:await setting('cf_safety','unknown'),detection:await setting('cf_detection','unknown'),updatedAt:await setting('cf_status_updated',''),source:'admin'});
  app.post('/api/cf/register',wrap(async(req,res)=>{
    rate(req);device(req);const {username,password,key}=req.body||{};
    if(!validUsername(String(username||''))||typeof password!=='string'||password.length<8||password.length>128||typeof key!=='string'||key.length>100||!key.trim())throw fail('invalid_registration');
    const token=crypto.randomBytes(32).toString('base64url');
    const u=await transaction(async db=>{
      const existing=await db.query('SELECT id,username,password_hash,disabled_at FROM users WHERE LOWER(username)=LOWER($1) FOR UPDATE',[username]);let u=existing.rows[0];
      if(u){if(u.disabled_at||!verifyPassword(password,u.password_hash))throw fail('account_exists',409);}
      else {const r=await db.query('INSERT INTO users(username,email,password_hash) VALUES($1,NULL,$2) RETURNING id,username',[username,passwordHash(password)]);u=r.rows[0];}
      await activateKey(db,key,u.id);await bindSession(db,req,u,token);await audit(db,req,u.id,'registration_activation');return u;
    });res.json({token,...await snapshot({user_id:u.id,username:u.username})});
  }));
  app.post('/api/cf/login',wrap(async(req,res)=>{
    rate(req);const id=device(req),identifier=String(req.body?.identifier||'').slice(0,160),password=String(req.body?.password||'').slice(0,129);
    const {rows}=await pool.query('SELECT id,username,password_hash,disabled_at FROM users WHERE LOWER(username)=LOWER($1) OR LOWER(email)=LOWER($1) LIMIT 1',[identifier]);
    const u=rows[0];if(!u||u.disabled_at||!verifyPassword(password,u.password_hash))throw fail('invalid_credentials',401);
    const token=crypto.randomBytes(32).toString('base64url');
    await transaction(async db=>{
      await bindSession(db,req,u,token);
      await audit(db,req,u.id,'login');
    });res.json({token,...await snapshot({user_id:u.id,username:u.username})});
  }));
  app.get('/api/account/cf/device-reset-request',requireUser,wrap(async(req,res)=>{
    const {rows}=await pool.query('SELECT r.status,r.requested_at,r.reviewed_at,(d.user_id IS NOT NULL) AS device_bound FROM cf_devices d FULL JOIN cf_device_reset_requests r ON r.user_id=d.user_id WHERE COALESCE(d.user_id,r.user_id)=$1',[req.userId]);
    res.json(rows[0]||{status:'none',device_bound:false});
  }));
  app.post('/api/account/cf/device-reset-request',requireUser,wrap(async(req,res)=>{
    const result=await transaction(async db=>{
      await db.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[req.userId]);
      const deviceRow=await db.query('SELECT user_id FROM cf_devices WHERE user_id=$1',[req.userId]);
      if(!deviceRow.rowCount)throw fail('device_not_bound',409);
      const {rows}=await db.query(`INSERT INTO cf_device_reset_requests(user_id,status) VALUES($1,'pending')
        ON CONFLICT(user_id) DO UPDATE SET status='pending',requested_at=NOW(),reviewed_at=NULL
        WHERE cf_device_reset_requests.status <> 'approved' RETURNING status,requested_at,reviewed_at`,[req.userId]);
      if(!rows[0])return (await db.query('SELECT status,requested_at,reviewed_at FROM cf_device_reset_requests WHERE user_id=$1',[req.userId])).rows[0];
      await audit(db,req,req.userId,'device_reset_request');return rows[0];
    });res.json(result);
  }));
  app.get('/api/cf/me',auth,wrap(async(req,res)=>res.json({...await snapshot(req.cf),status:await status()})));
  app.post('/api/cf/logout',auth,wrap(async(req,res)=>{await pool.query('DELETE FROM cf_sessions WHERE token_hash=$1',[req.cf.token_hash]);res.json({ok:true});}));
  // Background poll from the Android loader: bearer token + device only; no IP check, because mobile IPs change between polls.
  app.get('/api/cf/notifications',wrap(async(req,res)=>{
    const token=String(req.headers.authorization||'').replace(/^Bearer /,''),after=Math.max(0,Number(req.query.after)||0);
    const {rows}=await pool.query('SELECT 1 FROM cf_sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.device_hash=$2 AND s.expires_at>NOW() AND u.disabled_at IS NULL',[tokenHash(token),device(req)]);
    if(!rows[0])throw fail('unauthorized',401);
    const lang=language(req.headers['accept-language']);
    const list=await pool.query("SELECT id,title,body,texts,created_at FROM cf_notifications WHERE id>$1 AND created_at>NOW()-INTERVAL '7 days' ORDER BY id LIMIT 20",[after]);
    res.json({notifications:list.rows.map(({texts,...row})=>({...row,...(texts?.[lang]||texts?.pt||{})}))});
  }));
  app.get('/api/admin/cf/notifications',requireAdmin,wrap(async(_req,res)=>res.json({notifications:(await pool.query('SELECT id,title,body,texts,created_at FROM cf_notifications ORDER BY id DESC LIMIT 50')).rows})));
  app.post('/api/admin/cf/notifications',requireAdmin,wrap(async(req,res)=>{
    const langs=['pt','en','es','ru'],source=req.body?.texts&&typeof req.body.texts==='object'?req.body.texts:{pt:{title:req.body?.title,body:req.body?.body}},texts={};
    for(const l of langs){const t=source[l];if(!t)continue;const title=String(t.title||'').trim(),body=String(t.body||'').trim();if(!title&&!body)continue;if(!title||title.length>80||!body||body.length>500)throw fail('invalid_notification');texts[l]={title,body};}
    if(!texts.pt)throw fail('invalid_notification');
    res.json((await pool.query('INSERT INTO cf_notifications(title,body,texts) VALUES($1,$2,$3) RETURNING id,title,body,texts,created_at',[texts.pt.title,texts.pt.body,JSON.stringify(texts)])).rows[0]);
  }));
  app.post('/api/cf/activate',auth,wrap(async(req,res)=>{
    rate(req);await transaction(async db=>{
      await db.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[req.cf.user_id]);
      await activateKey(db,req.body?.key,req.cf.user_id);
      await audit(db,req,req.cf.user_id,'activation');
    });res.json(await snapshot(req.cf));
  }));
  app.get('/api/cf/release',auth,wrap(async(req,res)=>{
    if(!(await snapshot(req.cf)).expiresAt)throw fail('license_required',403);
    if((await status()).availability!=='online')throw fail('maintenance',503);
    const release=JSON.parse(await setting('cf_release','null'));if(!release)throw fail('release_unavailable',503);
    await audit(pool,req,req.cf.user_id,'release_check');res.json(release);
  }));
  app.get('/api/cf/loader-release',wrap(async(_req,res)=>{
    const release=JSON.parse(await setting('cf_loader_release','null'));if(!release)throw fail('release_unavailable',503);res.json(release);
  }));
  const fileDir=process.env.CF_FILE_DIR||path.resolve('data/counterframe');
  app.post('/api/admin/cf/upload',requireAdmin,wrap(async(req,res)=>{
    if(!String(req.headers['content-type']||'').startsWith('application/octet-stream'))throw fail('binary_required');
    const kind=String(req.headers['x-release-kind']||'auto');if(!['auto','loader','game'].includes(kind))throw fail('invalid_release');
    let loader=kind==='loader';const maxSize=loader?50000000:4500000000;
    const uploadId=String(req.headers['x-upload-id']||''),offset=Number(req.headers['x-upload-offset']),total=Number(req.headers['x-upload-total']);
    if(!/^[a-f0-9-]{36}$/.test(uploadId)||!Number.isSafeInteger(offset)||offset<0||!Number.isSafeInteger(total)||total<1||total>maxSize||offset>=total)throw fail('invalid_upload');
    await fs.promises.mkdir(fileDir,{recursive:true});const tmp=path.join(fileDir,uploadId+'.part');
    if(offset>0&&(await fs.promises.stat(tmp).catch(()=>null))?.size!==offset)throw fail('invalid_upload_offset',409);
    let size=0,retain=false;const digest=crypto.createHash('sha256');
    try{
      await pipeline(req,new Transform({transform(chunk,encoding,cb){size+=chunk.length;if(size>16777216||offset+size>total)return cb(fail('invalid_size'));cb(null,chunk);}}),fs.createWriteStream(tmp,{flags:offset?'a':'wx'}));
      if(size<1)throw fail('invalid_size');
      if(offset+size<total){retain=true;res.json({ok:true,offset:offset+size});return;}
      size=total;for await(const bytes of fs.createReadStream(tmp))digest.update(bytes);
      let meta;try{meta=await inspectApk(tmp,kind);}catch(e){throw fail(['wrong_package','invalid_signature','invalid_version'].includes(e.message)?e.message:'apk_validation_failed');}
      loader=meta.packageName==='com.cf.overlay';if(loader&&size>50000000)throw fail('invalid_size');
      const previous=JSON.parse(await setting(loader?'cf_loader_release':'cf_release','null'));
      const trustedCert=previous?.certificateSha256||process.env.CF_APK_CERT_SHA256||'92168fe76e8dd4f557e690bb84b071605d872672bc1b7cb6a4ef536fe2f94166';
      if(meta.certificateSha256!==trustedCert)throw fail('invalid_signature');
      const sha256=digest.digest('hex');
      if(loader&&previous&&meta.versionCode<=previous.versionCode&&sha256!==previous.sha256)throw fail('loader_version_must_increase');
      meta={...meta,size,sha256,publishedAt:new Date().toISOString()};
      const name=sha256+'.apk';await fs.promises.rename(tmp,path.join(fileDir,name));
      const url=(process.env.PUBLIC_SITE_URL||'https://legitbaratinho.xyz')+'/api/cf/'+(loader?'loader-apk':'game-apk');
      await setSetting(loader?'cf_loader_release':'cf_release',JSON.stringify({...meta,sha256:meta.sha256.toLowerCase(),certificateSha256:meta.certificateSha256.toLowerCase(),url}));res.json({ok:true,url});
    }finally{if(!retain)await fs.promises.unlink(tmp).catch(()=>{});}
  }));
  app.get('/api/cf/loader-apk',wrap(async(req,res)=>{const r=JSON.parse(await setting('cf_loader_release','null'));if(!r)throw fail('release_unavailable',404);res.download(path.join(fileDir,r.sha256+'.apk'),'LC-Counter Flame-Private.apk');}));
  app.get('/api/cf/game-apk',auth,wrap(async(req,res)=>{if(!(await snapshot(req.cf)).expiresAt)throw fail('license_required',403);if((await status()).availability!=='online')throw fail('maintenance',503);const r=JSON.parse(await setting('cf_release','null'));if(!r)throw fail('release_unavailable',404);res.download(path.join(fileDir,r.sha256+'.apk'),'Counter Flame.apk');}));
  app.post('/api/admin/cf/loader-release',requireAdmin,wrap(async(req,res)=>{
    const r=req.body||{},url=new URL(r.url);
    if(url.protocol!=='https:'||r.packageName!=='com.cf.overlay'||!Number.isSafeInteger(r.versionCode)||r.versionCode<1||!HEX.test(r.sha256)||!HEX.test(r.certificateSha256)||!Number.isSafeInteger(r.size)||r.size<1)throw fail('invalid_release');
    await setSetting('cf_loader_release',JSON.stringify({...r,url:url.href,sha256:r.sha256.toLowerCase(),certificateSha256:r.certificateSha256.toLowerCase()}));res.json({ok:true});
  }));
  app.get('/api/account/cf/keys',requireUser,wrap(async(req,res)=>{
    // Backfill paid Android orders, including purchases made before this migration.
    await transaction(async db=>{
      const {rows}=await db.query("SELECT id,user_id,plan_days,plan_lifetime,plan_name FROM checkout_payments WHERE user_id=$1 AND product_code IN ('counterframe-android','counterframe-ios') AND status='paid' ORDER BY id FOR UPDATE",[req.userId]);
      for(const p of rows)await issuePurchaseKey(db,p.id,p);
    });
    const {rows}=await pool.query('SELECT id,key_cipher,plan,activated_at,expires_at,revoked_at FROM cf_keys WHERE buyer_id=$1 ORDER BY id DESC',[req.userId]);
    res.json({keys:rows.map(({key_cipher,...r})=>({...r,key:decrypt(key_cipher)}))});
  }));
  app.get('/api/admin/cf',requireAdmin,wrap(async(_req,res)=>{
    const {rows}=await pool.query(`SELECT u.id,u.username,u.email,d.device_hash,d.bound_at,d.ip AS activation_ip,
      (SELECT MAX(expires_at) FROM cf_keys k WHERE k.claimed_by=u.id AND k.revoked_at IS NULL) AS expires_at,
      (SELECT MAX(last_seen) FROM cf_sessions s WHERE s.user_id=u.id) AS last_seen
      FROM users u LEFT JOIN cf_devices d ON d.user_id=u.id
      WHERE d.user_id IS NOT NULL
        OR EXISTS(SELECT 1 FROM cf_keys k WHERE k.buyer_id=u.id OR k.claimed_by=u.id)
        OR EXISTS(SELECT 1 FROM checkout_payments p WHERE p.user_id=u.id AND p.product_code IN ('counterframe-android','counterframe-ios'))
      ORDER BY u.id DESC LIMIT 500`);
    const events=await pool.query("SELECT a.*,u.username FROM access_audit a LEFT JOIN users u ON u.id=a.user_id WHERE a.product='counterframe-android' ORDER BY a.id DESC LIMIT 500");
    const resetRequests=await pool.query(`SELECT r.user_id,u.username,r.status,r.requested_at,r.reviewed_at,d.device_hash,d.ip AS current_ip
      FROM cf_device_reset_requests r JOIN users u ON u.id=r.user_id LEFT JOIN cf_devices d ON d.user_id=r.user_id
      ORDER BY (r.status='pending') DESC,r.requested_at DESC LIMIT 500`);
    res.json({users:rows,events:events.rows,resetRequests:resetRequests.rows,status:await status(),release:JSON.parse(await setting('cf_release','null')),loaderRelease:JSON.parse(await setting('cf_loader_release','null'))});
  }));
  app.post('/api/admin/cf/status',requireAdmin,wrap(async(req,res)=>{
    const {availability,safety,detection}=req.body||{};
    if(!['online','offline','maintenance'].includes(availability)||!['unknown','safe','unsafe'].includes(safety)||!['unknown','undetected','detected'].includes(detection))throw fail('invalid_status');
    await setSetting('cf_android_status',availability);await setSetting('cf_safety',safety);await setSetting('cf_detection',detection);await setSetting('cf_status_updated',new Date().toISOString());res.json(await status());
  }));
  app.post('/api/admin/cf/device-reset',requireAdmin,wrap(async(req,res)=>{
    const id=Number(req.body?.userId),decision=String(req.body?.decision||'');if(!Number.isSafeInteger(id)||id<1||!['approve','deny'].includes(decision))throw fail('invalid_request');
    await transaction(async db=>{
      await db.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[id]);
      const request=await db.query('SELECT status FROM cf_device_reset_requests WHERE user_id=$1 FOR UPDATE',[id]);
      if(request.rows[0]?.status!=='pending')throw fail('request_not_pending',409);
      const status=decision==='approve'?'approved':'denied';
      await db.query('UPDATE cf_device_reset_requests SET status=$2,reviewed_at=NOW() WHERE user_id=$1',[id,status]);
      await audit(db,req,id,decision==='approve'?'admin_device_reset_approved':'admin_device_reset_denied');
    });res.json({ok:true});
  }));
  app.post('/api/admin/cf/key',requireAdmin,wrap(async(req,res)=>{
    const lifetime=req.body?.lifetime===true,days=lifetime?0:Number(req.body?.days);if(!lifetime&&(!Number.isInteger(days)||days<1||days>3650))throw fail('invalid_duration');
    const key='CF-'+crypto.randomBytes(18).toString('hex').toUpperCase();
    await pool.query('INSERT INTO cf_keys(key_hash,key_cipher,days,plan,lifetime) VALUES($1,$2,$3,$4,$5)',[hash(key),encrypt(key),days,lifetime?'Lifetime':`${days}d`,lifetime]);res.json({key,days,lifetime});
  }));
  app.post('/api/admin/cf/release',requireAdmin,wrap(async(req,res)=>{
    const r=req.body||{};const url=new URL(r.url);
    if(url.protocol!=='https:'||r.packageName!=='com.ScarletWork.CounterFlame'||!Number.isSafeInteger(r.versionCode)||r.versionCode<1||!HEX.test(r.sha256)||!HEX.test(r.certificateSha256)||!Number.isSafeInteger(r.size)||r.size<1)throw fail('invalid_release');
    await setSetting('cf_release',JSON.stringify({url:url.href,packageName:r.packageName,versionCode:r.versionCode,sha256:r.sha256.toLowerCase(),certificateSha256:r.certificateSha256.toLowerCase(),size:r.size,label:String(r.label||'').slice(0,80)}));res.json({ok:true});
  }));
}

