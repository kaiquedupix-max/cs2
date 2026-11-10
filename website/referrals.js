import crypto from 'node:crypto';
export async function initReferrals(pool){await pool.query(`
 CREATE TABLE IF NOT EXISTS referral_codes(user_id BIGINT PRIMARY KEY REFERENCES users(id),code TEXT UNIQUE NOT NULL);
 ALTER TABLE checkout_payments ADD COLUMN IF NOT EXISTS referrer_id BIGINT REFERENCES users(id);
 CREATE TABLE IF NOT EXISTS referral_rewards(payment_id BIGINT PRIMARY KEY REFERENCES checkout_payments(id),referrer_id BIGINT NOT NULL REFERENCES users(id),buyer_id BIGINT NOT NULL REFERENCES users(id),product TEXT NOT NULL,seconds BIGINT NOT NULL,revoked_at TIMESTAMPTZ,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
 ALTER TABLE cf_keys ADD COLUMN IF NOT EXISTS referral_payment_id BIGINT UNIQUE REFERENCES checkout_payments(id);
 `);}
export async function resolveReferrer(pool,code,buyerId){if(!code)return null;const {rows}=await pool.query('SELECT user_id FROM referral_codes WHERE code=$1',[String(code).slice(0,40)]);const id=rows[0]?.user_id;return id&&String(id)!==String(buyerId)?id:null;}
export async function recomputeCounterframe(db,userId){
 const {rows}=await db.query('SELECT k.id,k.days,k.lifetime,k.activated_at,r.seconds FROM cf_keys k LEFT JOIN referral_rewards r ON r.payment_id=k.referral_payment_id WHERE k.claimed_by=$1 AND k.revoked_at IS NULL ORDER BY k.activated_at,k.id',[userId]);
 let cursor=0;const forever=Date.parse('9999-12-31T23:59:59Z');
 for(const key of rows){cursor=key.lifetime?forever:Math.min(forever,Math.max(cursor,new Date(key.activated_at).getTime())+Number(key.seconds??Number(key.days)*86400)*1000);await db.query('UPDATE cf_keys SET expires_at=$2 WHERE id=$1',[key.id,new Date(cursor).toISOString()]);}
}
export async function grantReferral(db,paymentId,payment){
 if(!payment.referrer_id||String(payment.referrer_id)===String(payment.user_id)||payment.plan_lifetime||!payment.plan_days)return;
 const seconds=Math.round(Number(payment.plan_days)*8640);if(seconds<1)return;
 const reward=await db.query('INSERT INTO referral_rewards(payment_id,referrer_id,buyer_id,product,seconds) VALUES($1,$2,$3,$4,$5) ON CONFLICT(payment_id) DO NOTHING RETURNING payment_id',[paymentId,payment.referrer_id,payment.user_id,payment.product_code,seconds]);if(!reward.rows.length)return;
 if(payment.product_code==='cs2'){
   await db.query(`INSERT INTO user_products(user_id,product_code,plan,purchased_at,expires_at) VALUES($1,'cs2','Indicação',NOW(),NOW()+($2 * INTERVAL '1 second')) ON CONFLICT(user_id,product_code) DO UPDATE SET expires_at=CASE WHEN user_products.expires_at>TIMESTAMPTZ '9999-01-01' THEN user_products.expires_at ELSE GREATEST(user_products.expires_at,NOW())+($2 * INTERVAL '1 second') END`,[payment.referrer_id,seconds]);
 }else{
   await db.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[payment.referrer_id]);
   const raw=crypto.randomBytes(32).toString('hex');
   await db.query(`INSERT INTO cf_keys(key_hash,key_cipher,days,plan,claimed_by,activated_at,expires_at,referral_payment_id) VALUES($1,'',0,'Bônus de indicação',$2,NOW(),CASE WHEN EXISTS(SELECT 1 FROM cf_keys WHERE claimed_by=$2 AND lifetime=TRUE AND revoked_at IS NULL) THEN TIMESTAMPTZ '9999-12-31 23:59:59+00' ELSE GREATEST(NOW(),COALESCE((SELECT MAX(expires_at) FROM cf_keys WHERE claimed_by=$2 AND revoked_at IS NULL),NOW()))+($3 * INTERVAL '1 second') END,$4)`,[raw,payment.referrer_id,seconds,paymentId]);
 }
}
export async function reverseReferral(db,paymentId){
 const r=await db.query('UPDATE referral_rewards SET revoked_at=NOW() WHERE payment_id=$1 AND revoked_at IS NULL RETURNING *',[paymentId]);const reward=r.rows[0];if(!reward)return;
 if(reward.product==='cs2')await db.query("UPDATE user_products SET expires_at=GREATEST(NOW(),expires_at-($2 * INTERVAL '1 second')) WHERE user_id=$1 AND product_code='cs2' AND expires_at<TIMESTAMPTZ '9999-01-01'",[reward.referrer_id,reward.seconds]);
 else {await db.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[reward.referrer_id]);await db.query('UPDATE cf_keys SET revoked_at=NOW() WHERE referral_payment_id=$1',[paymentId]);await recomputeCounterframe(db,reward.referrer_id);}
}
export function registerReferrals(app,{pool,requireUser}){
 app.get('/api/account/referrals',requireUser,async(req,res)=>{try{await pool.query('INSERT INTO referral_codes(user_id,code) VALUES($1,$2) ON CONFLICT(user_id) DO NOTHING',[req.userId,crypto.randomBytes(10).toString('hex')]);const c=await pool.query('SELECT code FROM referral_codes WHERE user_id=$1',[req.userId]);const rewards=await pool.query('SELECT product,seconds,created_at,revoked_at FROM referral_rewards WHERE referrer_id=$1 ORDER BY created_at DESC LIMIT 100',[req.userId]);res.json({url:(process.env.PUBLIC_URL||'https://legitbaratinho.xyz')+'/?ref='+c.rows[0].code,rewards:rewards.rows});}catch{res.status(500).json({error:'referrals_unavailable'});}});
}
