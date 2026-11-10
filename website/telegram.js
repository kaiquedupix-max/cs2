import crypto from 'node:crypto';
import {language} from './counterframe.js';

export const messages={
 pt:{welcome:'Legit .xyz • CF Private\nCompre sua licença e ative a key no loader Android.',buy:'Comprar',keys:'Minhas keys',lang:'Idioma',choose:'Escolha o idioma',empty:'Você ainda não tem keys.',off:'As compras estão temporariamente indisponíveis.',paid:'Pagamento confirmado. Sua key:',activate:'Crie sua conta no loader e ative esta key. Ela fica vinculada ao primeiro aparelho.',invoice:'Licença CounterFlame Android',days:'dias',error:'Não foi possível concluir. Tente novamente.'},
 en:{welcome:'Legit .xyz • CF Private\nBuy a license and activate the key in the Android loader.',buy:'Buy',keys:'My keys',lang:'Language',choose:'Choose your language',empty:'You have no keys yet.',off:'Purchases are temporarily unavailable.',paid:'Payment confirmed. Your key:',activate:'Create your loader account and activate this key. It binds to the first device.',invoice:'CounterFlame Android license',days:'days',error:'Unable to complete. Please try again.'},
 es:{welcome:'Legit .xyz • CF Private\nCompra una licencia y activa la key en el loader Android.',buy:'Comprar',keys:'Mis keys',lang:'Idioma',choose:'Elige el idioma',empty:'Todavía no tienes keys.',off:'Las compras no están disponibles temporalmente.',paid:'Pago confirmado. Tu key:',activate:'Crea tu cuenta en el loader y activa esta key. Queda vinculada al primer dispositivo.',invoice:'Licencia CounterFlame Android',days:'días',error:'No se pudo completar. Inténtalo de nuevo.'},
 ru:{welcome:'Legit .xyz • CF Private\nКупите лицензию и активируйте ключ в загрузчике Android.',buy:'Купить',keys:'Мои ключи',lang:'Язык',choose:'Выберите язык',empty:'У вас пока нет ключей.',off:'Покупки временно недоступны.',paid:'Оплата подтверждена. Ваш ключ:',activate:'Создайте аккаунт в загрузчике и активируйте ключ. Он привязывается к первому устройству.',invoice:'Лицензия CounterFlame Android',days:'дней',error:'Не удалось завершить. Попробуйте ещё раз.'}
};
export async function initTelegram(pool){await pool.query(`
 ALTER TABLE cf_keys ADD COLUMN IF NOT EXISTS telegram_id BIGINT;
 CREATE TABLE IF NOT EXISTS cf_bot_orders(payload TEXT PRIMARY KEY,telegram_id BIGINT NOT NULL,days INTEGER NOT NULL,stars INTEGER NOT NULL,charge_id TEXT UNIQUE,key_id BIGINT REFERENCES cf_keys(id));
 CREATE TABLE IF NOT EXISTS cf_bot_updates(id BIGINT PRIMARY KEY,processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
`);}
export function registerTelegram(app,{pool}){
 const api=async(method,body)=>{const token=process.env.CF_TELEGRAM_TOKEN;if(!token)throw Error('bot_not_configured');const r=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});const data=await r.json();if(!data.ok)throw Error('telegram_request_failed');return data.result;};
 const plans=()=>{try{return JSON.parse(process.env.CF_TELEGRAM_PLANS||'[]').filter(p=>Number.isSafeInteger(p.days)&&p.days>0&&p.days<=3650&&Number.isSafeInteger(p.stars)&&p.stars>0);}catch{return [];}};
 app.post('/api/cf/telegram',async(req,res)=>{
   const secret=process.env.CF_TELEGRAM_WEBHOOK_SECRET||'',actual=String(req.headers['x-telegram-bot-api-secret-token']||'');
   if(secret.length<24||actual.length!==secret.length||!crypto.timingSafeEqual(Buffer.from(secret),Buffer.from(actual)))return res.sendStatus(403);
   const update=req.body||{},q=update.callback_query,m=update.message,from=q?.from||m?.from||update.pre_checkout_query?.from;
   if(!pool||!from)return res.sendStatus(200);
   try{
     const row=await pool.query('SELECT language FROM cf_bot_users WHERE telegram_id=$1',[from.id]);const lang=row.rows[0]?.language||language(from.language_code),t=messages[lang];
     const send=(text,buttons=[])=>api('sendMessage',{chat_id:from.id,text,reply_markup:{inline_keyboard:buttons}});
     if(update.pre_checkout_query){const p=update.pre_checkout_query,r=await pool.query('SELECT * FROM cf_bot_orders WHERE payload=$1 AND telegram_id=$2 AND charge_id IS NULL',[p.invoice_payload,from.id]),o=r.rows[0];await api('answerPreCheckoutQuery',{pre_checkout_query_id:p.id,ok:!!o&&p.currency==='XTR'&&p.total_amount===o.stars,error_message:t.off});return res.sendStatus(200);}
     if(m?.refunded_payment){
       await pool.query('UPDATE cf_keys SET revoked_at=NOW() WHERE id IN (SELECT key_id FROM cf_bot_orders WHERE charge_id=$1 AND telegram_id=$2)',[m.refunded_payment.telegram_payment_charge_id,from.id]);return res.sendStatus(200);
     }
     if(m?.successful_payment){
       const p=m.successful_payment,db=await pool.connect();let raw;
       try{await db.query('BEGIN');const r=await db.query('SELECT * FROM cf_bot_orders WHERE payload=$1 AND telegram_id=$2 FOR UPDATE',[p.invoice_payload,from.id]),o=r.rows[0];
         if(!o||p.currency!=='XTR'||p.total_amount!==o.stars)throw Error('payment_mismatch');
         if(o.charge_id){const k=await db.query('SELECT key_cipher FROM cf_keys WHERE id=$1',[o.key_id]);raw=decodeKey(k.rows[0].key_cipher);}
         else{raw='CF-'+crypto.randomBytes(18).toString('hex').toUpperCase();const k=await db.query('INSERT INTO cf_keys(key_hash,key_cipher,days,plan,telegram_id) VALUES($1,$2,$3,$4,$5) RETURNING id',[crypto.createHash('sha256').update(raw).digest('hex'),encodeKey(raw),o.days,`${o.days}d`,from.id]);await db.query('UPDATE cf_bot_orders SET charge_id=$2,key_id=$3 WHERE payload=$1',[o.payload,p.telegram_payment_charge_id,k.rows[0].id]);}
         await db.query('COMMIT');
       }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
       await send(`${t.paid}\n${raw}\n\n${t.activate}`);return res.sendStatus(200);
     }
     if(q)await api('answerCallbackQuery',{callback_query_id:q.id});
     const action=q?.data||m?.text||'';
     if(action.startsWith('lang:')){const l=language(action.slice(5));await pool.query('INSERT INTO cf_bot_users(telegram_id,language) VALUES($1,$2) ON CONFLICT(telegram_id) DO UPDATE SET language=EXCLUDED.language',[from.id,l]);await send(messages[l].welcome);}
     else if(action==='language'||action==='/language'){await send(t.choose,[[{text:'Português',callback_data:'lang:pt'},{text:'English',callback_data:'lang:en'}],[{text:'Español',callback_data:'lang:es'},{text:'Русский',callback_data:'lang:ru'}]]);}
     else if(action==='keys'){const r=await pool.query('SELECT key_cipher FROM cf_keys WHERE telegram_id=$1 AND revoked_at IS NULL ORDER BY id DESC LIMIT 20',[from.id]);await send(r.rows.length?r.rows.map(k=>decodeKey(k.key_cipher)).join('\n'):t.empty);}
     else if(action.startsWith('plan:')){const plan=plans().find(p=>String(p.days)===action.slice(5));if(!plan){await send(t.off);return res.sendStatus(200);}const payload=crypto.randomBytes(24).toString('hex');await pool.query('INSERT INTO cf_bot_orders(payload,telegram_id,days,stars) VALUES($1,$2,$3,$4)',[payload,from.id,plan.days,plan.stars]);await api('sendInvoice',{chat_id:from.id,title:t.invoice,description:`${plan.days} ${t.days}`,payload,currency:'XTR',prices:[{label:t.invoice,amount:plan.stars}]});}
     else if(action==='buy'){const p=plans();await send(p.length?t.buy:t.off,p.map(p=>[{text:`${p.days} ${t.days} · ${p.stars} ⭐`,callback_data:`plan:${p.days}`} ]));}
     else await send(t.welcome,[[{text:t.buy,callback_data:'buy'},{text:t.keys,callback_data:'keys'}],[{text:t.lang,callback_data:'language'}]]);
     res.sendStatus(200);
   }catch{res.sendStatus(500);}
 });
}
function encodeKey(raw){const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',crypto.createHash('sha256').update(process.env.SESSION_SECRET).digest(),iv);return Buffer.concat([iv,c.update(raw,'utf8'),c.final(),c.getAuthTag()]).toString('base64');}
function decodeKey(raw){const b=Buffer.from(raw,'base64'),d=crypto.createDecipheriv('aes-256-gcm',crypto.createHash('sha256').update(process.env.SESSION_SECRET).digest(),b.subarray(0,12));d.setAuthTag(b.subarray(-16));return Buffer.concat([d.update(b.subarray(12,-16)),d.final()]).toString('utf8');}
