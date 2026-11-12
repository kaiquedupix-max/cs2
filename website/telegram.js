import crypto from 'node:crypto';
import {BOT_PLANS,botPlan,botAmount,botText,planLabel,brl,botPaymentMethods,setBotApi,startPixPayment,startMercadoPagoCard,startStripeCard,confirmBotOrder,validCpf} from './botPayments.js';
async function botLink(api){let bot=String(process.env.CF_TELEGRAM_BOT_USERNAME||'').replace(/^@/,'');if(!bot){try{bot=(await api('getMe',{})).username||'';}catch{}}return bot?'https://t.me/'+bot:String(process.env.PUBLIC_SITE_URL||'https://legitbaratinho.xyz');}
import {language} from './counterframe.js';
import {checkoutPlan} from './mercadoPago.js';
import {couponDiscount,reserveCoupon} from './coupons.js';
import {TERMS_VERSION} from './terms.js';
import {recomputeCounterframe} from './referrals.js';

export const messages={
 pt:{welcome:'LC - Counter Flame Private\nCompre sua licença e ative a key no loader Android.',buy:'Comprar',keys:'Minhas keys',lang:'Idioma',choose:'Escolha o idioma',empty:'Você ainda não tem keys.',off:'As compras estão temporariamente indisponíveis.',paid:'Pagamento confirmado. Sua key:',activate:'Crie sua conta no loader e ative esta key. Ela fica vinculada ao primeiro aparelho.',invoice:'Licença Counter Flame Android',lifetime:'Permanente',days:'dias',error:'Não foi possível concluir. Tente novamente.'},
 en:{welcome:'LC - Counter Flame Private\nBuy a license and activate the key in the Android loader.',buy:'Buy',keys:'My keys',lang:'Language',choose:'Choose your language',empty:'You have no keys yet.',off:'Purchases are temporarily unavailable.',paid:'Payment confirmed. Your key:',activate:'Create your loader account and activate this key. It binds to the first device.',invoice:'Counter Flame Android license',lifetime:'Lifetime',days:'days',error:'Unable to complete. Please try again.'},
 es:{welcome:'LC - Counter Flame Private\nCompra una licencia y activa la key en el loader Android.',buy:'Comprar',keys:'Mis keys',lang:'Idioma',choose:'Elige el idioma',empty:'Todavía no tienes keys.',off:'Las compras no están disponibles temporalmente.',paid:'Pago confirmado. Tu key:',activate:'Crea tu cuenta en el loader y activa esta key. Queda vinculada al primer dispositivo.',invoice:'Licencia Counter Flame Android',lifetime:'De por vida',days:'días',error:'No se pudo completar. Inténtalo de nuevo.'},
 ru:{welcome:'LC - Counter Flame Private\nКупите лицензию и активируйте ключ в загрузчике Android.',buy:'Купить',keys:'Мои ключи',lang:'Язык',choose:'Выберите язык',empty:'У вас пока нет ключей.',off:'Покупки временно недоступны.',paid:'Оплата подтверждена. Ваш ключ:',activate:'Создайте аккаунт в загрузчике и активируйте ключ. Он привязывается к первому устройству.',invoice:'Лицензия Counter Flame Android',lifetime:'Навсегда',days:'дней',error:'Не удалось завершить. Попробуйте ещё раз.'}
};
Object.assign(messages.pt,{coupon:'Cupom',couponPrompt:'Envie /coupon CODIGO para aplicar seu desconto.',couponApplied:'Cupom aplicado:',couponInvalid:'Cupom inválido ou expirado.'});
Object.assign(messages.en,{coupon:'Coupon',couponPrompt:'Send /coupon CODE to apply your discount.',couponApplied:'Coupon applied:',couponInvalid:'Invalid or expired coupon.'});
Object.assign(messages.es,{coupon:'Cupón',couponPrompt:'Envía /coupon CODIGO para aplicar el descuento.',couponApplied:'Cupón aplicado:',couponInvalid:'Cupón inválido o vencido.'});
Object.assign(messages.ru,{coupon:'Промокод',couponPrompt:'Отправьте /coupon КОД для применения скидки.',couponApplied:'Промокод применён:',couponInvalid:'Промокод неверен или истёк.'});
Object.assign(messages.pt,{features:'Funções',featureText:'Counter Flame • Recursos do menu\n\nESP: caixas, esqueletos, nomes, vida, distância, armas, linhas e filtros de equipe.\nMira: FOV, seleção de cabeça/pescoço/peito, suavidade, força, distância e ativação ao disparar.\nPersonalização: cores, espessura, opacidade e quatro idiomas.\nLoader: conta, key, licença, versões e atualizações.',terms:'Termos',agree:'Li e aceito • continuar',policy:'Não oferecemos reembolsos voluntários, ressalvados os obrigatórios por lei. Leia os termos antes de comprar.',support:'Suporte: use o atendimento em legitbaratinho.xyz. Para ajuda com pagamentos, informe o identificador da compra.',download:'Baixar loader Android'});
Object.assign(messages.en,{features:'Features',featureText:'Counter Flame • Menu features\n\nESP: boxes, skeletons, names, health, distance, weapons, lines and team filters.\nAim: FOV, head/neck/chest selection, smoothing, strength, distance and fire activation.\nCustomization: colors, thickness, opacity and four languages.\nLoader: account, key, license, releases and updates.',terms:'Terms',agree:'I have read and agree • continue',policy:'No voluntary refunds, except refunds required by law. Read the terms before buying.',support:'Support: use the support chat at legitbaratinho.xyz. For payment help, provide the purchase identifier.',download:'Download Android loader'});
Object.assign(messages.es,{features:'Funciones',featureText:'Counter Flame • Funciones del menú\n\nESP: cajas, esqueletos, nombres, salud, distancia, armas, líneas y filtros de equipo.\nMira: FOV, cabeza/cuello/pecho, suavidad, fuerza, distancia y activación al disparar.\nPersonalización: colores, grosor, opacidad y cuatro idiomas.\nLoader: cuenta, key, licencia, versiones y actualizaciones.',terms:'Términos',agree:'He leído y acepto • continuar',policy:'Sin reembolsos voluntarios, salvo los obligatorios por ley. Lee los términos antes de comprar.',support:'Soporte: usa la atención en legitbaratinho.xyz. Para ayuda con pagos, indica el identificador de compra.',download:'Descargar loader Android'});
Object.assign(messages.ru,{features:'Функции',featureText:'Counter Flame • Функции меню\n\nESP: рамки, скелеты, имена, здоровье, расстояние, оружие, линии и фильтры команд.\nПрицел: FOV, голова/шея/грудь, плавность, сила, расстояние и активация при стрельбе.\nНастройка: цвета, толщина, прозрачность и четыре языка.\nЗагрузчик: аккаунт, ключ, лицензия, версии и обновления.',terms:'Условия',agree:'Я прочитал и согласен • продолжить',policy:'Добровольные возвраты не предусмотрены, кроме обязательных по закону. Перед покупкой прочитайте условия.',support:'Поддержка: используйте чат на legitbaratinho.xyz. По вопросам оплаты укажите идентификатор покупки.',download:'Скачать загрузчик Android'});

Object.assign(messages.pt,{affiliate:'Indicar amigos',affiliateLink:'Seu link de indicação: {url}',affiliateKey:'Você ganhou {duration} de licença. Resgate no loader com /resgatar SEU_USUARIO {key}',affiliateCredited:'{duration} adicionados à sua conta do loader.',redeem:'Resgatar key',redeemPrompt:'Envie /resgatar USUARIO KEY.',redeemSuccess:'Key resgatada para {username}: +{duration}.',redeemFail:'Não foi possível resgatar. Confira usuário e key.',adminOnly:'Acesso restrito ao administrador.',adminSummary:'Bot: {users} usuários • starts {starts} • vendas {sales} • keys {keys}.',resetUsage:'Uso: /adminreset ID_DA_KEY',resetDone:'Key #{id} redefinida.',adminUsers:'Usuários / starts',adminSales:'Vendas',adminLogs:'Logs',adminKeys:'Keys',adminRefs:'Afiliados',reportUsers:'Usuários / starts (20 recentes):',reportSales:'Vendas recentes:',reportLogs:'Atividade recente:',reportRefs:'Indicações e recompensas:',reportKeys:'Keys Telegram recentes:'});
Object.assign(messages.en,{affiliate:'Invite friends',affiliateLink:'Your referral link: {url}',affiliateKey:'You earned {duration} of license. Redeem in the loader with /redeem YOUR_USERNAME {key}',affiliateCredited:'{duration} added to your loader account.',redeem:'Redeem key',redeemPrompt:'Send /redeem USERNAME KEY.',redeemSuccess:'Key redeemed for {username}: +{duration}.',redeemFail:'Could not redeem. Check the username and key.',adminOnly:'Administrator access only.',adminSummary:'Bot: {users} users • starts {starts} • sales {sales} • keys {keys}.',resetUsage:'Usage: /adminreset KEY_ID',resetDone:'Key #{id} reset.',adminUsers:'Users / starts',adminSales:'Sales',adminLogs:'Logs',adminKeys:'Keys',adminRefs:'Affiliates',reportUsers:'Users / starts (20 recent):',reportSales:'Recent sales:',reportLogs:'Recent activity:',reportRefs:'Referrals and rewards:',reportKeys:'Recent Telegram keys:'});
Object.assign(messages.es,{affiliate:'Invitar amigos',affiliateLink:'Tu enlace de referido: {url}',affiliateKey:'Ganaste {duration} de licencia. Canjéalo en el loader con /resgatar TU_USUARIO {key}',affiliateCredited:'Se añadieron {duration} a tu cuenta del loader.',redeem:'Canjear key',redeemPrompt:'Envía /resgatar USUARIO KEY.',redeemSuccess:'Key canjeada para {username}: +{duration}.',redeemFail:'No se pudo canjear. Comprueba el usuario y la key.',adminOnly:'Acceso solo para administradores.',adminSummary:'Bot: {users} usuarios • inicios {starts} • ventas {sales} • keys {keys}.',resetUsage:'Uso: /adminreset ID_DE_KEY',resetDone:'Key #{id} restablecida.',adminUsers:'Usuarios / inicios',adminSales:'Ventas',adminLogs:'Registros',adminKeys:'Keys',adminRefs:'Afiliados',reportUsers:'Usuarios / inicios (20 recientes):',reportSales:'Ventas recientes:',reportLogs:'Actividad reciente:',reportRefs:'Referidos y recompensas:',reportKeys:'Keys recientes de Telegram:'});
Object.assign(messages.ru,{affiliate:'Пригласить друзей',affiliateLink:'Ваша реферальная ссылка: {url}',affiliateKey:'Вы получили {duration} лицензии. Активируйте в загрузчике: /resgatar ВАШ_ЛОГИН {key}',affiliateCredited:'{duration} добавлено к лицензии в загрузчике.',redeem:'Активировать ключ',redeemPrompt:'Отправьте /resgatar ЛОГИН КЛЮЧ.',redeemSuccess:'Ключ активирован для {username}: +{duration}.',redeemFail:'Не удалось активировать. Проверьте логин и ключ.',adminOnly:'Доступ только для администратора.',adminSummary:'Бот: пользователей {users} • запусков {starts} • продаж {sales} • ключей {keys}.',resetUsage:'Использование: /adminreset ID_КЛЮЧА',resetDone:'Ключ #{id} сброшен.',adminUsers:'Пользователи / запуски',adminSales:'Продажи',adminLogs:'Журнал',adminKeys:'Ключи',adminRefs:'Рефералы',reportUsers:'Пользователи / запуски (20 последних):',reportSales:'Последние продажи:',reportLogs:'Последние события:',reportRefs:'Рефералы и награды:',reportKeys:'Последние ключи Telegram:'});
export async function initTelegram(pool){await pool.query(`
 ALTER TABLE cf_keys ADD COLUMN IF NOT EXISTS telegram_id BIGINT;
 ALTER TABLE cf_keys ADD COLUMN IF NOT EXISTS duration_seconds BIGINT;
 ALTER TABLE cf_bot_users ADD COLUMN IF NOT EXISTS username TEXT,ADD COLUMN IF NOT EXISTS first_name TEXT,ADD COLUMN IF NOT EXISTS last_name TEXT,ADD COLUMN IF NOT EXISTS first_started_at TIMESTAMPTZ,ADD COLUMN IF NOT EXISTS last_started_at TIMESTAMPTZ,ADD COLUMN IF NOT EXISTS start_count INTEGER NOT NULL DEFAULT 0,ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ,ADD COLUMN IF NOT EXISTS referrer_telegram_id BIGINT,ADD COLUMN IF NOT EXISTS linked_user_id BIGINT REFERENCES users(id),ADD COLUMN IF NOT EXISTS coupon_code TEXT,ADD COLUMN IF NOT EXISTS terms_version TEXT,ADD COLUMN IF NOT EXISTS terms_accepted_at TIMESTAMPTZ;
 CREATE TABLE IF NOT EXISTS cf_bot_orders(payload TEXT PRIMARY KEY,telegram_id BIGINT NOT NULL,days INTEGER NOT NULL,stars INTEGER NOT NULL,charge_id TEXT UNIQUE,key_id BIGINT REFERENCES cf_keys(id),coupon_code TEXT,referrer_telegram_id BIGINT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),delivered_at TIMESTAMPTZ,refunded_at TIMESTAMPTZ,lifetime BOOLEAN NOT NULL DEFAULT FALSE,plan_key TEXT NOT NULL DEFAULT 'd30');
 ALTER TABLE cf_bot_orders ADD COLUMN IF NOT EXISTS coupon_code TEXT,ADD COLUMN IF NOT EXISTS referrer_telegram_id BIGINT,ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,ADD COLUMN IF NOT EXISTS refunded_at TIMESTAMPTZ,ADD COLUMN IF NOT EXISTS lifetime BOOLEAN NOT NULL DEFAULT FALSE,ADD COLUMN IF NOT EXISTS plan_key TEXT NOT NULL DEFAULT 'd30';
 ALTER TABLE cf_bot_orders ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'telegram_stars',ADD COLUMN IF NOT EXISTS amount_cents INTEGER,ADD COLUMN IF NOT EXISTS currency TEXT,ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',ADD COLUMN IF NOT EXISTS provider_ref TEXT,ADD COLUMN IF NOT EXISTS pix_copy_paste TEXT,ADD COLUMN IF NOT EXISTS pix_expires_at TIMESTAMPTZ,ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
 ALTER TABLE cf_bot_users ADD COLUMN IF NOT EXISTS pending_action TEXT;
 CREATE TABLE IF NOT EXISTS cf_bot_updates(id BIGINT PRIMARY KEY,processed_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
 CREATE TABLE IF NOT EXISTS cf_bot_events(id BIGSERIAL PRIMARY KEY,update_id BIGINT UNIQUE,telegram_id BIGINT,username TEXT,event TEXT NOT NULL,command TEXT,details JSONB NOT NULL DEFAULT '{}'::jsonb,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
 CREATE INDEX IF NOT EXISTS cf_bot_events_recent ON cf_bot_events(created_at DESC);
 CREATE TABLE IF NOT EXISTS cf_bot_referral_rewards(order_payload TEXT PRIMARY KEY,referrer_telegram_id BIGINT NOT NULL,buyer_telegram_id BIGINT NOT NULL,reward_seconds BIGINT NOT NULL,key_id BIGINT REFERENCES cf_keys(id),created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
`);}
export function registerTelegram(app,{pool,telegramApi}){
 const api=telegramApi|| (async(method,body)=>{const token=process.env.CF_TELEGRAM_TOKEN;if(!token)throw Error('bot_not_configured');const multipart=body instanceof FormData;const r=await fetch(`https://api.telegram.org/bot${token}/${method}`,{method:'POST',headers:multipart?{}:{'Content-Type':'application/json'},body:multipart?body:JSON.stringify(body),signal:AbortSignal.timeout(method==='sendDocument'?120000:15000)});const data=await r.json();if(!data.ok)throw Error('telegram_request_failed');return data.result;});
 setBotApi(api);
 const sendLoaderApk=async(chatId,caption)=>{
   const base=String(process.env.PUBLIC_SITE_URL||'https://legitbaratinho.xyz').replace(/\/$/,'');
   const response=await fetch(base+'/api/cf/loader-apk',{signal:AbortSignal.timeout(120000)});
   const disposition=String(response.headers.get('content-disposition')||'');
   const size=Number(response.headers.get('content-length')||0);
   if(!response.ok||!disposition.toLowerCase().includes('.apk')||size>50000000)throw Error('loader_apk_unavailable');
   const bytes=await response.arrayBuffer();
   if(!bytes.byteLength||bytes.byteLength>50000000)throw Error('loader_apk_size_invalid');
   const form=new FormData();
   form.set('chat_id',String(chatId));
   form.set('caption',caption);
   form.set('document',new Blob([bytes],{type:'application/vnd.android.package-archive'}),'LC-Counter-Flame-Private.apk');
   await api('sendDocument',form);
 };
 const adminIds=new Set(String(process.env.CF_TELEGRAM_ADMIN_IDS||process.env.TELEGRAM_ADMIN_IDS||"").split(",").map(x=>x.trim()).filter(Boolean));
 const botUsername=String(process.env.CF_TELEGRAM_USERNAME||process.env.TELEGRAM_BOT_USERNAME||"LegitCheatsCFBot").replace(/^@/,"");
 const event=async(update,from,type,command="",details={})=>{
   const clean=JSON.stringify(details).slice(0,2000);
   await pool.query("INSERT INTO cf_bot_events(update_id,telegram_id,username,event,command,details) VALUES($1,$2,$3,$4,$5,$6::jsonb) ON CONFLICT(update_id) DO UPDATE SET telegram_id=EXCLUDED.telegram_id,username=EXCLUDED.username,event=EXCLUDED.event,command=EXCLUDED.command,details=EXCLUDED.details",
     [update.update_id||null,from?.id||null,String(from?.username||"").slice(0,64),type,String(command||"").slice(0,80),clean]);
 };
 const redeemKey=async(telegramId,username,keyText)=>{
   const db=await pool.connect();try{
     await db.query("BEGIN");
     const u=await db.query("SELECT id,username FROM users WHERE LOWER(username)=LOWER($1) AND disabled_at IS NULL FOR UPDATE",[String(username).slice(0,28)]);
     if(!u.rows[0])throw Error("account_not_found");
     const raw=String(keyText||"").trim().toUpperCase(),keyHash=crypto.createHash("sha256").update(raw).digest("hex");
     const r=await db.query("SELECT * FROM cf_keys WHERE key_hash=$1 FOR UPDATE",[keyHash]),k=r.rows[0];
     if(!k||k.revoked_at||k.claimed_by||!(k.telegram_id==null||String(k.telegram_id)===String(telegramId)))throw Error("key_unavailable");
     const duration=Number(k.duration_seconds||Number(k.days||0)*86400);
     if(!k.lifetime&&(!Number.isSafeInteger(duration)||duration<1))throw Error("invalid_key_duration");
     await db.query("UPDATE cf_keys SET claimed_by=$2,buyer_id=COALESCE(buyer_id,$2),activated_at=NOW(),expires_at=CASE WHEN lifetime OR EXISTS(SELECT 1 FROM cf_keys WHERE claimed_by=$2 AND revoked_at IS NULL AND lifetime=TRUE) THEN TIMESTAMPTZ '9999-12-31 23:59:59+00' ELSE GREATEST(NOW(),COALESCE((SELECT MAX(expires_at) FROM cf_keys WHERE claimed_by=$2 AND revoked_at IS NULL),NOW()))+($3 * INTERVAL '1 second') END WHERE id=$1",[k.id,u.rows[0].id,k.lifetime?0:duration]);
     await db.query("UPDATE cf_bot_users SET linked_user_id=$2 WHERE telegram_id=$1",[String(telegramId),u.rows[0].id]);
     await recomputeCounterframe(db,u.rows[0].id);
     await db.query("COMMIT");return u.rows[0].username;
   }catch(e){await db.query("ROLLBACK");throw e;}finally{db.release();}
 };
 const formatDuration=seconds=>{const d=Math.floor(seconds/86400),h=Math.floor((seconds%86400)/3600);return d?d+"d "+h+"h":h+"h";};
 const adminReport=async(view,lang)=>{
   const t=messages[lang];
   if(view==="users"){const r=await pool.query("SELECT telegram_id::text AS id,username,first_name,language,start_count,first_started_at,last_seen_at FROM cf_bot_users ORDER BY COALESCE(last_seen_at,first_started_at) DESC NULLS LAST LIMIT 20");return t.reportUsers+"\n"+(r.rows.map(x=>x.id+" • @"+(x.username||"—")+" • starts "+x.start_count+" • "+x.language).join("\n")||"—");}
   if(view==="sales"){const r=await pool.query("SELECT payload AS id,telegram_id::text AS tg,days,stars,lifetime,charge_id,created_at,key_id FROM cf_bot_orders ORDER BY created_at DESC LIMIT 20");return t.reportSales+"\n"+(r.rows.map(x=>"#"+x.id+" • "+x.days+"d • "+x.stars+"⭐ • TG "+x.tg+" • "+(x.charge_id?"paid":"pending")+" • key "+(x.key_id||"—")).join("\n")||"—");}
   if(view==="logs"){const r=await pool.query("SELECT telegram_id::text AS tg,username,event,command,created_at FROM cf_bot_events ORDER BY id DESC LIMIT 30");return t.reportLogs+"\n"+(r.rows.map(x=>x.event+" • "+(x.command||"—")+" • @"+(x.username||x.tg||"—")+" • "+new Date(x.created_at).toLocaleString(lang==="pt"?"pt-BR":lang)).join("\n")||"—");}
   if(view==="refs"){const r=await pool.query("SELECT referrer_telegram_id::text AS referrer,COUNT(*)::int AS sales,COALESCE(SUM(reward_seconds),0)::bigint AS seconds FROM cf_bot_referral_rewards GROUP BY referrer_telegram_id ORDER BY sales DESC LIMIT 20");return t.reportRefs+"\n"+(r.rows.map(x=>x.referrer+" • "+x.sales+" • "+formatDuration(Number(x.seconds))).join("\n")||"—");}
   const r=await pool.query("SELECT id,telegram_id::text AS tg,days,plan,claimed_by,revoked_at FROM cf_keys WHERE telegram_id IS NOT NULL ORDER BY id DESC LIMIT 20");return t.reportKeys+"\n"+(r.rows.map(x=>"#"+x.id+" • "+x.days+"d • TG "+x.tg+" • "+(x.revoked_at?"revoked":x.claimed_by?"redeemed":"pending")).join("\n")||"—");
 };
 const adminKeyboard=lang=>({inline_keyboard:[[{text:messages[lang].adminUsers,callback_data:"admin:users"},{text:messages[lang].adminSales,callback_data:"admin:sales"}],[{text:messages[lang].adminLogs,callback_data:"admin:logs"},{text:messages[lang].adminKeys,callback_data:"admin:keys"}],[{text:messages[lang].adminRefs,callback_data:"admin:refs"}]]});
 const resetTelegramKey=async(id)=>{
   const db=await pool.connect();try{
     await db.query("BEGIN");
     const r=await db.query("SELECT k.*,o.telegram_id AS order_telegram FROM cf_keys k JOIN cf_bot_orders o ON o.key_id=k.id WHERE k.id=$1 FOR UPDATE OF k,o",[Number(id)]),k=r.rows[0];
     if(!k||k.revoked_at||!k.telegram_id)throw Error("key_not_found");
     if(k.claimed_by)await db.query("SELECT id FROM users WHERE id=$1 FOR UPDATE",[k.claimed_by]);
     const raw="CF-"+crypto.randomBytes(18).toString("hex").toUpperCase();
     await db.query("UPDATE cf_keys SET key_hash=$2,key_cipher=$3,claimed_by=NULL,activated_at=NULL,expires_at=NULL,revoked_at=NULL WHERE id=$1",[k.id,crypto.createHash("sha256").update(raw).digest("hex"),encodeKey(raw)]);
     if(k.claimed_by)await recomputeCounterframe(db,k.claimed_by);
     await db.query("COMMIT");return {id:Number(k.id),raw,telegramId:String(k.order_telegram),claimedBy:k.claimed_by};
   }catch(e){await db.query("ROLLBACK");throw e;}finally{db.release();}
 };

 const plans=()=>{const starBrl=Number(process.env.CF_STAR_BRL_PER_UNIT||95/750),usdBrl=Number(process.env.CF_STAR_USD_BRL_RATE||process.env.CF_USD_BRL_RATE||5.55);if(!Number.isFinite(starBrl)||starBrl<=0||!Number.isFinite(usdBrl)||usdBrl<=0)return [];return ['d1','d7','d15','d30','lifetime'].map(key=>checkoutPlan(key,'counterframe')).filter(Boolean).map(p=>({key:p.key,days:p.days||0,lifetime:Boolean(p.lifetime),name:p.name,usdPriceCents:p.usdPriceCents,stars:Math.ceil((p.usdPriceCents/100*usdBrl)/starBrl)}));};
 app.post('/api/cf/telegram',async(req,res)=>{
   const botToken=process.env.CF_TELEGRAM_TOKEN||'';
   const secret=process.env.CF_TELEGRAM_WEBHOOK_SECRET||(botToken?crypto.createHash('sha256').update(botToken).digest('hex'):''),actual=String(req.headers['x-telegram-bot-api-secret-token']||'');
   if(secret.length<24||actual.length!==secret.length||!crypto.timingSafeEqual(Buffer.from(secret),Buffer.from(actual)))return res.sendStatus(403);
   const update=req.body||{},q=update.callback_query,m=update.message,from=q?.from||m?.from||update.pre_checkout_query?.from;
   if(!pool||!from)return res.sendStatus(200);
   try{
     const incoming=String(m?.text||""),isStart=/^\/start(?:\s|$)/i.test(incoming),deep=/^\/start\s+ref_([1-9][0-9]{0,18})$/i.exec(incoming);
     const referrer=deep&&deep[1]!==String(from.id)?deep[1]:null;
     await pool.query(`INSERT INTO cf_bot_users(telegram_id,language,username,first_name,last_name,first_started_at,last_started_at,start_count,last_seen_at,referrer_telegram_id)
       VALUES($1,$2,$3,$4,$5,CASE WHEN $6::boolean THEN NOW() END,CASE WHEN $6::boolean THEN NOW() END,CASE WHEN $6::boolean THEN 1 ELSE 0 END,NOW(),$7)
       ON CONFLICT(telegram_id) DO UPDATE SET username=EXCLUDED.username,first_name=EXCLUDED.first_name,last_name=EXCLUDED.last_name,
       last_seen_at=NOW(),last_started_at=CASE WHEN $6::boolean THEN NOW() ELSE cf_bot_users.last_started_at END,
       start_count=cf_bot_users.start_count+CASE WHEN $6::boolean THEN 1 ELSE 0 END,
       referrer_telegram_id=COALESCE(cf_bot_users.referrer_telegram_id,EXCLUDED.referrer_telegram_id)`,
       [String(from.id),language(from.language_code),String(from.username||"").slice(0,64),String(from.first_name||"").slice(0,120),String(from.last_name||"").slice(0,120),isStart,referrer]);
     const row=await pool.query('SELECT language,coupon_code,terms_version,referrer_telegram_id FROM cf_bot_users WHERE telegram_id=$1',[from.id]);const lang=row.rows[0]?.language||language(from.language_code),t=messages[lang];let accepted=row.rows[0]?.terms_version===TERMS_VERSION;
     const send=(text,buttons=[])=>api('sendMessage',{chat_id:from.id,text,reply_markup:{inline_keyboard:buttons}});
     if(update.pre_checkout_query){const p=update.pre_checkout_query,r=await pool.query('SELECT * FROM cf_bot_orders WHERE payload=$1 AND telegram_id=$2 AND charge_id IS NULL',[p.invoice_payload,from.id]),o=r.rows[0];await event(update,from,o?"pre_checkout":"invalid_pre_checkout","pre_checkout",{payload:p.invoice_payload,currency:p.currency,stars:p.total_amount});await api('answerPreCheckoutQuery',{pre_checkout_query_id:p.id,ok:!!o&&p.currency==='XTR'&&p.total_amount===o.stars,error_message:t.off});return res.sendStatus(200);}
     if(m?.refunded_payment){
       const charge=m.refunded_payment.telegram_payment_charge_id,db=await pool.connect();let accountId=null;
       try{await db.query('BEGIN');const k=await db.query('SELECT k.claimed_by FROM cf_keys k JOIN cf_bot_orders o ON o.key_id=k.id WHERE o.charge_id=$1 AND o.telegram_id=$2 FOR UPDATE',[charge,from.id]);accountId=k.rows[0]?.claimed_by||null;if(accountId)await db.query('SELECT id FROM users WHERE id=$1 FOR UPDATE',[accountId]);await db.query('UPDATE cf_keys SET revoked_at=NOW() WHERE id IN (SELECT key_id FROM cf_bot_orders WHERE charge_id=$1 AND telegram_id=$2)',[charge,from.id]);await db.query('UPDATE cf_bot_orders SET refunded_at=NOW() WHERE charge_id=$1 AND telegram_id=$2',[charge,from.id]);if(accountId)await recomputeCounterframe(db,accountId);await db.query('COMMIT');}catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
       await event(update,from,"payment_refund","successful_payment",{charge_id:charge});return res.sendStatus(200);
     }
     if(m?.successful_payment){
       const p=m.successful_payment,db=await pool.connect();let raw,bonus=null;
       try{
         await db.query('BEGIN');
         const r=await db.query('SELECT * FROM cf_bot_orders WHERE payload=$1 AND telegram_id=$2 FOR UPDATE',[p.invoice_payload,from.id]),o=r.rows[0];
         if(!o||p.currency!=='XTR'||p.total_amount!==o.stars)throw Error('payment_mismatch');
         if(o.charge_id){const k=await db.query('SELECT key_cipher FROM cf_keys WHERE id=$1',[o.key_id]);raw=decodeKey(k.rows[0].key_cipher);}
         else{
           raw='CF-'+crypto.randomBytes(18).toString('hex').toUpperCase();
           const k=await db.query('INSERT INTO cf_keys(key_hash,key_cipher,days,plan,telegram_id,duration_seconds,lifetime) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id',
             [crypto.createHash('sha256').update(raw).digest('hex'),encodeKey(raw),o.days,o.lifetime?'Lifetime':String(o.days)+'d',from.id,o.lifetime?0:o.days*86400,o.lifetime]);
           await db.query('UPDATE cf_bot_orders SET charge_id=$2,key_id=$3,delivered_at=NOW() WHERE payload=$1',[o.payload,p.telegram_payment_charge_id,k.rows[0].id]);
           const ref=String(o.referrer_telegram_id||"");
           if(ref&&ref!==String(from.id)){
             const seconds=Math.max(1,Math.floor(Number(o.days)*8640));
             const already=await db.query('SELECT 1 FROM cf_bot_referral_rewards WHERE order_payload=$1',[o.payload]);
             if(!already.rowCount){
               bonus='CF-'+crypto.randomBytes(18).toString('hex').toUpperCase();
               const linked=await db.query('SELECT linked_user_id FROM cf_bot_users WHERE telegram_id=$1',[ref]),linkedId=linked.rows[0]?.linked_user_id||null;
               const reward=await db.query(`INSERT INTO cf_keys(key_hash,key_cipher,days,plan,telegram_id,duration_seconds,buyer_id,claimed_by,activated_at,expires_at)
                 VALUES($1,$2,$3,$4,$5,$6,$7,$7,CASE WHEN $7::bigint IS NULL THEN NULL ELSE NOW() END,
                 CASE WHEN $7::bigint IS NULL THEN NULL WHEN EXISTS(SELECT 1 FROM cf_keys WHERE claimed_by=$7 AND revoked_at IS NULL AND lifetime=TRUE) THEN TIMESTAMPTZ '9999-12-31 23:59:59+00' ELSE GREATEST(NOW(),COALESCE((SELECT MAX(expires_at) FROM cf_keys WHERE claimed_by=$7 AND revoked_at IS NULL),NOW()))+($6::bigint * INTERVAL '1 second') END) RETURNING id`,
                 [crypto.createHash('sha256').update(bonus).digest('hex'),encodeKey(bonus),Math.max(1,Math.ceil(seconds/86400)),'Affiliate 10%',ref,seconds,linkedId]);
               await db.query('INSERT INTO cf_bot_referral_rewards(order_payload,referrer_telegram_id,buyer_telegram_id,reward_seconds,key_id) VALUES($1,$2,$3,$4,$5) ON CONFLICT(order_payload) DO NOTHING',[o.payload,ref,String(from.id),seconds,reward.rows[0].id]);
               if(linkedId)await recomputeCounterframe(db,linkedId);
               bonus={raw:bonus,referrer:ref,seconds,linked:Boolean(linkedId)};
             }
           }
         }
         await db.query('COMMIT');
       }catch(e){await db.query('ROLLBACK');throw e;}finally{db.release();}
       await event(update,from,"sale_delivered","successful_payment",{payload:p.invoice_payload,stars:p.total_amount});
       await send(`${t.paid}\n${raw}\n\n${t.activate}\n\n/resgatar USUARIO KEY`);try{await sendLoaderApk(from.id,t.download);}catch(error){console.error('Falha ao anexar loader no Telegram:',error?.message||error);await send(t.download+': https://legitbaratinho.xyz/api/cf/loader-apk');}
       if(bonus){const refText=bonus.linked?t.affiliateCredited.replace("{duration}",formatDuration(bonus.seconds)):t.affiliateKey.replace("{duration}",formatDuration(bonus.seconds)).replace("{key}",bonus.raw);await api('sendMessage',{chat_id:bonus.referrer,text:refText});await event({...update,update_id:null},{id:bonus.referrer},"affiliate_reward","successful_payment",{reward_seconds:bonus.seconds});}
       return res.sendStatus(200);
     }
     if(q)await api('answerCallbackQuery',{callback_query_id:q.id});
     let action=String(q?.data||m?.text||'').trim();
     const pendingRowBot=await pool.query('SELECT pending_action FROM cf_bot_users WHERE telegram_id=$1',[from.id]);const pendingPixCpf=!q&&String(pendingRowBot.rows[0]?.pending_action||'').startsWith('pix_cpf:');const command=(pendingPixCpf?'pix_cpf_input':action).split(/\s+/)[0].toLowerCase().split("@")[0];
     if(action==='agree'){await pool.query('INSERT INTO cf_bot_users(telegram_id,language,terms_version,terms_accepted_at) VALUES($1,$2,$3,NOW()) ON CONFLICT(telegram_id) DO UPDATE SET terms_version=EXCLUDED.terms_version,terms_accepted_at=NOW()',[from.id,lang,TERMS_VERSION]);accepted=true;action='buy';}
     if(command==='/start'){
       await event(update,from,"start","/start",{referred_by:row.rows[0]?.referrer_telegram_id||null});
       const buttons=[[{text:t.buy,callback_data:'buy'},{text:t.keys,callback_data:'keys'}],[{text:t.affiliate,callback_data:'affiliate'},{text:t.redeem,callback_data:'redeem'}],[{text:t.features,callback_data:'features'},{text:t.lang,callback_data:'language'}],[{text:t.coupon,callback_data:'coupon'},{text:t.terms,callback_data:'terms'}]];
       const caption=t.welcome;try{await api('sendPhoto',{chat_id:from.id,photo:'https://legitbaratinho.xyz/media/lc-counterflame-cover.jpg',caption,reply_markup:{inline_keyboard:buttons}});}catch{await send(caption,buttons);}return res.sendStatus(200);
     }
     if(action==='/buy'||action==='/shop')action='buy';
     if(action==='/keys')action='keys';
     if(action==='/affiliate'||action==='/referral')action='affiliate';
     if(action==='/redeem'||action==='/resgatar')action='redeem';
     await event(update,from,command==='/redeem'||command==='/resgatar'?'redeem_attempt':q?'callback':'command',command==='/redeem'||command==='/resgatar'?command:command,{action:command==='/redeem'||command==='/resgatar'?'redeem':action.split(/\s+/)[0]});
     if(command==='/admin'||action==='admin'){
       if(!adminIds.has(String(from.id))){await send(t.adminOnly);return res.sendStatus(200);}
       const r=await pool.query("SELECT (SELECT COUNT(*)::int FROM cf_bot_users) users,(SELECT COALESCE(SUM(start_count),0)::int FROM cf_bot_users) starts,(SELECT COUNT(*)::int FROM cf_bot_orders WHERE charge_id IS NOT NULL AND refunded_at IS NULL) sales,(SELECT COUNT(*)::int FROM cf_keys WHERE telegram_id IS NOT NULL AND revoked_at IS NULL) keys");
       await send(t.adminSummary.replace("{users}",r.rows[0].users).replace("{starts}",r.rows[0].starts).replace("{sales}",r.rows[0].sales).replace("{keys}",r.rows[0].keys),adminKeyboard(lang));return res.sendStatus(200);
     }
     if(action.startsWith("admin:")){
       if(!adminIds.has(String(from.id))){await send(t.adminOnly);return res.sendStatus(200);}
       const view=action.slice(6);await send(await adminReport(view,lang),adminKeyboard(lang));return res.sendStatus(200);
     }
     if(command==='/adminreset'){
       if(!adminIds.has(String(from.id))){await send(t.adminOnly);return res.sendStatus(200);}
       const id=action.split(/\s+/)[1];if(!/^\d+$/.test(id||"")){await send(t.resetUsage);return res.sendStatus(200);}
       const replacement=await resetTelegramKey(id);
       const targetLang=(await pool.query("SELECT language FROM cf_bot_users WHERE telegram_id=$1",[replacement.telegramId])).rows[0]?.language||"en";
       await api('sendMessage',{chat_id:replacement.telegramId,text:messages[targetLang].resetDone.replace("{id}",replacement.id)+"\n\n"+replacement.raw});
       await event(update,from,"key_reset","/adminreset",{key_id:replacement.id,target_telegram_id:replacement.telegramId});
       await send(t.resetDone.replace("{id}",replacement.id));return res.sendStatus(200);
     }
     if(command==='/redeem'||command==='/resgatar'||action==='redeem'){
       const parts=action.split(/\s+/);
       if(parts.length<3){await send(t.redeemPrompt);return res.sendStatus(200);}
       try{const username=await redeemKey(from.id,parts[1],parts[2]);const keyRow=await pool.query("SELECT duration_seconds,days FROM cf_keys WHERE key_hash=$1",[crypto.createHash("sha256").update(parts[2].trim().toUpperCase()).digest("hex")]);const seconds=Number(keyRow.rows[0]?.duration_seconds||Number(keyRow.rows[0]?.days||0)*86400);await send(t.redeemSuccess.replace("{duration}",formatDuration(seconds)).replace("{username}",username));await event(update,from,"key_redeemed","/redeem",{username});}catch(error){console.error('Falha ao resgatar key:',error?.message||error);await send(t.redeemFail);}return res.sendStatus(200);
     }
     if(action==='/buy'||action==='/shop')action='buy';
     if(action==='/terms'||action==='terms'||((action==='buy'||action.startsWith('plan:')||action.startsWith('bplan:')||action.startsWith('pix:')||action.startsWith('mpcard:')||action.startsWith('stripecard:')||action.startsWith('check:'))&&!accepted)){await send(t.policy,[[{text:t.terms,url:'https://legitbaratinho.xyz/terms.html?lang='+lang}],[{text:t.agree,callback_data:'agree'}]]);return res.sendStatus(200);}
     if(action==='features'||action==='/features'){await send(t.featureText);return res.sendStatus(200);}
     if(action==='/paysupport'||action==='/support'){await send(t.support);return res.sendStatus(200);}
     if(pendingPixCpf){
       const bt=botText(lang),key=String(pendingRowBot.rows[0].pending_action).slice(8),plan=botPlan(key),cpf=String(action).replace(/\D/g,'');
       if(!plan){await pool.query('UPDATE cf_bot_users SET pending_action=NULL WHERE telegram_id=$1',[from.id]);await send(bt.error);return res.sendStatus(200);}
       if(!validCpf(cpf)){await send(bt.cpfInvalid);return res.sendStatus(200);}
       await pool.query('UPDATE cf_bot_users SET pending_action=NULL WHERE telegram_id=$1',[from.id]);
       let coupon;try{coupon=await couponDiscount(pool,row.rows[0]?.coupon_code,'counterframe');}catch{await send(t.couponInvalid);return res.sendStatus(200);}
       try{
         const out=await startPixPayment(pool,{telegramId:from.id,plan,couponPercent:coupon.percent,couponCode:coupon.code,referrer:row.rows[0]?.referrer_telegram_id||null,cpf,lang});
         const expires=out.expires?` ${bt.pixExpires} ${new Date(out.expires).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo'})}`:'';
         await send(`${bt.pixReady}${expires}\n\n${out.qr}`,[[{text:bt.check,callback_data:'check:'+out.payload}]]);
       }catch(error){console.error('Falha no PIX do bot:',error?.message||error);await send(bt.error);}
       return res.sendStatus(200);
     }
     if(action.startsWith('lang:')){const l=language(action.slice(5));await pool.query('INSERT INTO cf_bot_users(telegram_id,language) VALUES($1,$2) ON CONFLICT(telegram_id) DO UPDATE SET language=EXCLUDED.language',[from.id,l]);await send(messages[l].welcome);}
     else if(action==='language'||action==='/language'){await send(t.choose,[[{text:'Português',callback_data:'lang:pt'},{text:'English',callback_data:'lang:en'}],[{text:'Español',callback_data:'lang:es'},{text:'Русский',callback_data:'lang:ru'}]]);}
     else if(action==='keys'){const r=await pool.query('SELECT key_cipher FROM cf_keys WHERE telegram_id=$1 AND revoked_at IS NULL ORDER BY id DESC LIMIT 20',[from.id]);await send(r.rows.length?r.rows.map(k=>decodeKey(k.key_cipher)).join('\n'):t.empty);}
     else if(action==='affiliate'){
       const code=String(from.id),url="https://t.me/"+botUsername+"?start=ref_"+code,r=await pool.query("SELECT COUNT(*)::int AS n,COALESCE(SUM(reward_seconds),0)::bigint AS seconds FROM cf_bot_referral_rewards WHERE referrer_telegram_id=$1",[code]);
       await send(t.affiliateLink.replace("{url}",url)+"\n\n"+r.rows[0].n+" • "+formatDuration(Number(r.rows[0].seconds)));
     }
     else if(action.startsWith('/coupon ')){try{const c=await couponDiscount(pool,action.slice(8).trim(),'counterframe');await pool.query('INSERT INTO cf_bot_users(telegram_id,language,coupon_code) VALUES($1,$2,$3) ON CONFLICT(telegram_id) DO UPDATE SET coupon_code=EXCLUDED.coupon_code',[from.id,lang,c.code]);await send(t.couponApplied+' '+c.percent+'%');}catch{await send(t.couponInvalid);}}
     else if(action==='coupon'||action==='/coupon')await send(t.couponPrompt);
     else if(action.startsWith('plan:')){const plan=plans().find(p=>String(p.key)===action.slice(5));if(!plan){await send(t.off);return res.sendStatus(200);}let coupon;try{coupon=await couponDiscount(pool,row.rows[0]?.coupon_code,'counterframe');}catch{await send(t.couponInvalid);return res.sendStatus(200);}const stars=Math.max(1,Math.ceil(plan.stars*(100-coupon.percent)/100)),payload=crypto.randomBytes(24).toString('hex');if(coupon.code)await reserveCoupon(pool,coupon.code,'counterframe','telegram:'+payload);await pool.query('INSERT INTO cf_bot_orders(payload,telegram_id,days,stars,coupon_code,referrer_telegram_id,lifetime,plan_key) VALUES($1,$2,$3,$4,$5,$6,$7,$8)',[payload,from.id,plan.days,stars,coupon.code,row.rows[0]?.referrer_telegram_id||null,Boolean(plan.lifetime),plan.key]);await api('sendInvoice',{chat_id:from.id,title:t.invoice,description:plan.lifetime?t.lifetime:String(plan.days)+' '+t.days,payload,currency:'XTR',prices:[{label:t.invoice,amount:stars}]});}
     else if(action.startsWith('bplan:')){
       const plan=botPlan(action.slice(6)),bt=botText(lang);if(!plan){await send(bt.off);return res.sendStatus(200);}
       const methods=botPaymentMethods(),starsPlan=plans().find(p=>String(p.key)===plan.key),price=brl(botAmount(plan,0)),buttons=[];
       if(starsPlan)buttons.push([{text:starsPlan.stars+' ⭐ Stars',callback_data:'plan:'+plan.key}]);
       if(methods.pix)buttons.push([{text:'PIX · '+price,callback_data:'pix:'+plan.key}]);
       if(methods.mpCard)buttons.push([{text:bt.cardLabelMp+' · '+price,callback_data:'mpcard:'+plan.key}]);
       if(methods.stripeCard)buttons.push([{text:bt.cardLabelStripe+' · '+price,callback_data:'stripecard:'+plan.key}]);
       if(!buttons.length){await send(bt.off);return res.sendStatus(200);}
       await send(planLabel(plan,lang)+'\n'+bt.payMethod,buttons);
     }
     else if(action.startsWith('pix:')){
       const plan=botPlan(action.slice(4));if(!plan||!botPaymentMethods().pix){await send(botText(lang).off);return res.sendStatus(200);}
       await pool.query('UPDATE cf_bot_users SET pending_action=$2 WHERE telegram_id=$1',[from.id,'pix_cpf:'+plan.key]);
       await send(botText(lang).pixCpf);
     }
     else if(action.startsWith('mpcard:')){
       const plan=botPlan(action.slice(7)),bt=botText(lang);if(!plan||!botPaymentMethods().mpCard){await send(bt.off);return res.sendStatus(200);}
       let coupon;try{coupon=await couponDiscount(pool,row.rows[0]?.coupon_code,'counterframe');}catch{await send(t.couponInvalid);return res.sendStatus(200);}
       try{const out=await startMercadoPagoCard(pool,{telegramId:from.id,plan,couponPercent:coupon.percent,couponCode:coupon.code,referrer:row.rows[0]?.referrer_telegram_id||null,lang,backUrl:await botLink(api)});await send(bt.cardReady,[[{text:bt.payCard,url:out.url}],[{text:bt.check,callback_data:'check:'+out.payload}]]);}
       catch(error){console.error('Falha no cartão Mercado Pago do bot:',error?.message||error);await send(bt.error);}
     }
     else if(action.startsWith('stripecard:')){
       const plan=botPlan(action.slice(11)),bt=botText(lang);if(!plan||!botPaymentMethods().stripeCard){await send(bt.off);return res.sendStatus(200);}
       let coupon;try{coupon=await couponDiscount(pool,row.rows[0]?.coupon_code,'counterframe');}catch{await send(t.couponInvalid);return res.sendStatus(200);}
       try{const out=await startStripeCard(pool,{telegramId:from.id,plan,couponPercent:coupon.percent,couponCode:coupon.code,referrer:row.rows[0]?.referrer_telegram_id||null,lang,successUrl:await botLink(api)});await send(bt.cardReady,[[{text:bt.payCard,url:out.url}],[{text:bt.check,callback_data:'check:'+out.payload}]]);}
       catch(error){console.error('Falha no cartão Stripe do bot:',error?.message||error);await send(bt.error);}
     }
     else if(action.startsWith('check:')){
       const bt=botText(lang),r=await pool.query("SELECT * FROM cf_bot_orders WHERE payload=$1 AND telegram_id=$2 AND provider<>'telegram_stars'",[action.slice(6),from.id]),o=r.rows[0];
       if(!o)await send(bt.error);else if(o.status==='paid')await send(bt.alreadyPaid);
       else{try{if(!await confirmBotOrder(pool,o,api))await send(bt.pending);}catch(error){console.error('Falha ao verificar pagamento do bot:',error?.message||error);await send(bt.pending);}}
     }
     else if(action==='buy'){await send(t.buy,BOT_PLANS.map(p=>[{text:planLabel(p,lang)+' · '+brl(botAmount(p,0)),callback_data:'bplan:'+p.key}]));}
     else {const buttons=[[{text:t.buy,callback_data:'buy'},{text:t.keys,callback_data:'keys'}],[{text:t.affiliate,callback_data:'affiliate'},{text:t.redeem,callback_data:'redeem'}],[{text:t.features,callback_data:'features'},{text:t.lang,callback_data:'language'}],[{text:t.coupon,callback_data:'coupon'},{text:t.terms,callback_data:'terms'}]];await send(t.welcome,buttons);}
     res.sendStatus(200);
   }catch(error){console.error('Falha no webhook Telegram:',error?.stack||error?.message||error);res.sendStatus(500);}
 });
}
function encodeKey(raw){const iv=crypto.randomBytes(12),c=crypto.createCipheriv('aes-256-gcm',crypto.createHash('sha256').update(process.env.SESSION_SECRET).digest(),iv);return Buffer.concat([iv,c.update(raw,'utf8'),c.final(),c.getAuthTag()]).toString('base64');}
function decodeKey(raw){const b=Buffer.from(raw,'base64'),d=crypto.createDecipheriv('aes-256-gcm',crypto.createHash('sha256').update(process.env.SESSION_SECRET).digest(),b.subarray(0,12));d.setAuthTag(b.subarray(-16));return Buffer.concat([d.update(b.subarray(12,-16)),d.final()]).toString('utf8');}

