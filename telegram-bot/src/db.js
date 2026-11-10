import pg from "pg";

let pool;
export function connectDb() {
  const connectionString=String(process.env.DATABASE_URL||"").trim();
  if(!connectionString) throw new Error("DATABASE_URL must be set");
  if(!pool) pool=new pg.Pool({connectionString,max:5,connectionTimeoutMillis:10000});
  return pool;
}
function db(){return connectDb();}
export async function initDb(){
  await db().query([
    "CREATE TABLE IF NOT EXISTS cf_bot_users (telegram_id BIGINT PRIMARY KEY, username TEXT, language TEXT NOT NULL DEFAULT 'en',",
    "market TEXT NOT NULL DEFAULT 'INTL' CHECK (market IN ('BR','INTL')), referred_by BIGINT,",
    "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());",
    "CREATE TABLE IF NOT EXISTS cf_bot_coupons (code TEXT PRIMARY KEY,",
    "discount_percent INTEGER NOT NULL CHECK (discount_percent BETWEEN 1 AND 90),",
    "max_uses INTEGER NOT NULL DEFAULT 100 CHECK(max_uses>0),used INTEGER NOT NULL DEFAULT 0,",
    "expires_at TIMESTAMPTZ,created_by BIGINT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());",
    "CREATE TABLE IF NOT EXISTS cf_bot_orders (id BIGSERIAL PRIMARY KEY,",
    "telegram_id BIGINT NOT NULL REFERENCES cf_bot_users(telegram_id),",
    "platform TEXT NOT NULL CHECK(platform IN ('android','ios')),",
    "plan_id TEXT NOT NULL CHECK(plan_id IN ('d1','d7','d15','d30')),",
    "status TEXT NOT NULL DEFAULT 'draft',total_stars INTEGER,total_usd_cents INTEGER,coupon_code TEXT,",
    "telegram_charge_id TEXT UNIQUE,paid_at TIMESTAMPTZ,delivered_at TIMESTAMPTZ,",
    "created_at TIMESTAMPTZ NOT NULL DEFAULT NOW());",
    "CREATE INDEX IF NOT EXISTS cf_bot_orders_user_idx ON cf_bot_orders(telegram_id,created_at DESC);",
    "CREATE INDEX IF NOT EXISTS cf_bot_referrals_idx ON cf_bot_users(referred_by);",
    "CREATE TABLE IF NOT EXISTS cf_bot_runtime (key TEXT PRIMARY KEY,value TEXT NOT NULL,updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW());"
  ].join("\n"));
}
export async function getOffset() {
 const r=await db().query("SELECT value FROM cf_bot_runtime WHERE key='offset'");
 return Number(r.rows[0]?.value||0);
}
export async function saveOffset(offset) {
 await db().query("INSERT INTO cf_bot_runtime(key,value) VALUES('offset',$1) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()",[String(offset)]);
}
export async function upsertUser(user){
 const lang=String(user.lang||"en"),market=lang==="pt"?"BR":"INTL";
 const r=await db().query([
   "INSERT INTO cf_bot_users(telegram_id,username,language,market) VALUES($1,$2,$3,$4)",
   "ON CONFLICT(telegram_id) DO UPDATE SET username=EXCLUDED.username,updated_at=NOW()",
   "RETURNING telegram_id::text AS id,username,language,market,referred_by::text AS referred_by"
 ].join(" "),[String(user.id),String(user.username||"").slice(0,64),lang,market]);
 return r.rows[0];
}
export async function setUserLanguage(id,language){
 await db().query("UPDATE cf_bot_users SET language=$2,updated_at=NOW() WHERE telegram_id=$1",[String(id),language]);
}
export async function setUserMarket(id,market){
 await db().query("UPDATE cf_bot_users SET market=$2,updated_at=NOW() WHERE telegram_id=$1",[String(id),market]);
}
export async function tryRefer(userId,referrerId) {
 const a=String(userId),b=String(referrerId);
 if(a===b||!/^[1-9]\d{0,18}$/.test(b)) return false;
 const r=await db().query([
  "UPDATE cf_bot_users SET referred_by=$2,updated_at=NOW()",
  "WHERE telegram_id=$1 AND referred_by IS NULL AND EXISTS(SELECT 1 FROM cf_bot_users WHERE telegram_id=$2)",
  "RETURNING telegram_id"
 ].join(" "),[a,b]);
 return r.rowCount>0;
}
export async function getReferralCount(id){
 const r=await db().query("SELECT COUNT(*)::integer AS count FROM cf_bot_users WHERE referred_by=$1",[String(id)]);
 return r.rows[0]?.count||0;
}
export async function lookupCoupon(raw){
 const code=String(raw||"").trim().toUpperCase();
 if(!/^[A-Z0-9_-]{3,24}$/.test(code))return null;
 const r=await db().query([
  "SELECT code,discount_percent,max_uses,used,expires_at FROM cf_bot_coupons",
  "WHERE code=$1 AND used<max_uses AND (expires_at IS NULL OR expires_at>NOW())"
 ].join(" "),[code]);
 return r.rows[0]||null;
}
export async function adminCreateCoupon({code,pct,maxUses,adminId}){
 const clean=String(code||"").toUpperCase();
 if(!/^[A-Z0-9_-]{3,24}$/.test(clean))throw new Error("Invalid code");
 if(!Number.isInteger(pct)||pct<1||pct>90)throw new Error("Percentage must be 1..90");
 if(!Number.isInteger(maxUses)||maxUses<1||maxUses>100000)throw new Error("Invalid limit");
 await db().query([
  "INSERT INTO cf_bot_coupons(code,discount_percent,max_uses,created_by) VALUES($1,$2,$3,$4)",
  "ON CONFLICT(code) DO UPDATE SET discount_percent=EXCLUDED.discount_percent,max_uses=EXCLUDED.max_uses,created_by=EXCLUDED.created_by"
 ].join(" "),[clean,pct,maxUses,String(adminId)]);
}
export async function listOrders(id){
 const r=await db().query([
  "SELECT id,platform,plan_id,status,total_stars,created_at FROM cf_bot_orders",
  "WHERE telegram_id=$1 AND status<>'draft' ORDER BY created_at DESC LIMIT 10"
 ].join(" "),[String(id)]);
 return r.rows;
}
export async function adminStats(){
 const r=await db().query([
  "SELECT (SELECT COUNT(*)::integer FROM cf_bot_users) AS users,",
  "(SELECT COUNT(*)::integer FROM cf_bot_orders WHERE status='paid') AS paid_orders,",
  "(SELECT COUNT(*)::integer FROM cf_bot_users WHERE referred_by IS NOT NULL) AS referred_users"
 ].join(" "));
 return r.rows[0];
}
