import express from "express";
import cookieParser from "cookie-parser";
import crypto from "node:crypto";
import pg from "pg";
import { registerCheckoutRoutes } from "./checkoutRoutes.js";
import { registerSupportRoutes } from "./supportRoutes.js";
import { registerCounterframe, initCounterframe } from "./counterframe.js";
import { registerTelegram, initTelegram } from "./telegram.js";
import { registerTelegramAdmin } from "./telegramAdmin.js";
import { initCoupons, registerCoupons } from "./coupons.js";
import { visitorCountry } from "./geoMarket.js";
import { PRODUCT_CATALOG } from "./catalog.js";
import { registerAdminStats } from "./adminStats.js";
import { initReferrals, registerReferrals } from './referrals.js';
import {initTerms} from './terms.js';
import { createRegistry } from "./productRegistry.js";
import { buildManifest, signManifest, inspectUpload, publicKeyOf } from "./releaseManifest.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
if (process.env.TRUST_PROXY) app.set('trust proxy', Number(process.env.TRUST_PROXY));
const port = Number(process.env.PORT || 3000);

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === "true"
        ? { rejectUnauthorized: false }
        : undefined,
    })
  : null;

const ADMIN_COOKIE = "lb_admin";
const USER_COOKIE = "lb_user";
const ADMIN_SESSION_MS = 12 * 60 * 60 * 1000;
const USER_SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const CLIENT_SESSION_MS = 12 * 60 * 60 * 1000;
const PRODUCT_CODE = "cs2";
// Products live in productRegistry.js (built-ins) plus catalog_products (added from the admin panel).
// Legacy lookup: requests without a product, or with an unknown one, keep the CS2 behaviour. Admin publish routes
// use registry.resolveStrict instead so a typo can never write into the CS2 channel.
const registry = createRegistry();
const PRODUCTS = registry.products;
const accessProductOf = registry.accessProductOf;
function productOf(req) {
  const raw = String(
    req.headers?.["x-product"] || req.body?.product || req.query?.product || PRODUCT_CODE
  ).trim().toLowerCase();
  return registry.has(raw) ? raw : PRODUCT_CODE;
}
const strictProductOf = (req) => registry.resolveStrict(req.headers?.["x-product"] || req.query?.product);
// ECDSA P-256 private key (PEM) used to sign release manifests. Never committed; "\n" escapes are accepted for env vars.
const signingKeyPem = () => (process.env.RELEASE_SIGNING_KEY || "").replace(/\\n/g, "\n").trim();
app.disable("x-powered-by");
app.use(express.json({
  limit: "512kb",
  verify(req, _res, buffer) {
    req.rawBody = Buffer.from(buffer);
  },
}));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public"), {
  maxAge: 0,
  etag: true,
  setHeaders(res) {
    res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  },
}));

function sha256(value) {
  const input = Buffer.isBuffer(value)
    ? value
    : Buffer.from(String(value), "utf8");

  return crypto.createHash("sha256").update(input).digest("hex");
}

function safeEqual(a, b) {
  const aa = Buffer.from(String(a));
  const bb = Buffer.from(String(b));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

function sessionSecret() {
  return process.env.SESSION_SECRET || "";
}

function signSession(payload) {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = crypto
    .createHmac("sha256", sessionSecret())
    .update(body)
    .digest("base64url");
  return body + "." + signature;
}

function verifySession(token) {
  if (!token || !sessionSecret()) return null;
  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const expected = crypto
    .createHmac("sha256", sessionSecret())
    .update(body)
    .digest("base64url");

  if (!safeEqual(signature, expected)) return null;

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function passwordHash(password, salt = crypto.randomBytes(16).toString("hex")) {
  const derived = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return salt + ":" + derived;
}

function verifyPassword(password, stored) {
  const [salt, expected] = String(stored || "").split(":");
  if (!salt || !expected) return false;
  const actual = crypto.scryptSync(String(password), salt, 64).toString("hex");
  return safeEqual(actual, expected);
}

function validUsername(value) {
  return /^[a-zA-Z0-9_.-]{3,28}$/.test(value);
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 160;
}

function requireAdmin(req, res, next) {
  const session = verifySession(req.cookies?.[ADMIN_COOKIE]);
  if (!session?.admin) return res.status(401).json({ error: "unauthorized" });
  next();
}

async function requireUser(req, res, next) {
  const session = verifySession(req.cookies?.[USER_COOKIE]);
  if (!session?.userId || session?.kind !== "web") {
    return res.status(401).json({ error: "unauthorized" });
  }

  if (!pool) return res.status(503).json({ error: "database_not_configured" });

  const result = await pool.query(
    "SELECT disabled_at FROM users WHERE id = $1 LIMIT 1",
    [Number(session.userId)]
  );

  const user = result.rows[0];
  if (!user || user.disabled_at) {
    res.clearCookie(USER_COOKIE);
    return res.status(403).json({
      error: "account_banned",
      message: "Esta conta está bloqueada.",
    });
  }

  req.userId = Number(session.userId);
  next();
}

async function optionalUser(req, res, next) {
  const session = verifySession(req.cookies?.[USER_COOKIE]);

  if (!session?.userId || session?.kind !== "web" || !pool) {
    return next();
  }

  try {
    const result = await pool.query(
      "SELECT disabled_at FROM users WHERE id = $1 LIMIT 1",
      [Number(session.userId)]
    );

    const user = result.rows[0];
    if (!user || user.disabled_at) {
      res.clearCookie(USER_COOKIE);
      return next();
    }

    req.userId = Number(session.userId);
  } catch {
    // Configuração pública do checkout continua disponível mesmo se a sessão não puder ser validada.
  }

  next();
}

async function requireClient(req, res, next) {
  const header = String(req.headers.authorization || "");
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const session = verifySession(token);

  if (!session?.userId || session?.kind !== "loader") {
    return res.status(401).json({ error: "unauthorized" });
  }

  const hwid = String(req.headers["x-device-id"] || "").trim();
  if (!/^[a-f0-9]{64}$/i.test(hwid)) {
    return res.status(401).json({
      error: "device_required",
      message: "Identificação do computador ausente.",
    });
  }

  const hwidHash = sha256(hwid);
  if (!session.hwidHash || !safeEqual(session.hwidHash, hwidHash)) {
    return res.status(403).json({
      error: "device_mismatch",
      message: "Esta sessão pertence a outro computador.",
    });
  }

  if (!pool) return res.status(503).json({ error: "database_not_configured" });

  const result = await pool.query(
    `SELECT disabled_at, hwid_hash
     FROM users
     WHERE id = $1
     LIMIT 1`,
    [Number(session.userId)]
  );

  const user = result.rows[0];
  if (!user || user.disabled_at) {
    return res.status(403).json({
      error: "account_banned",
      message: "Esta conta está bloqueada.",
    });
  }

  if (!user.hwid_hash || !safeEqual(user.hwid_hash, hwidHash)) {
    return res.status(403).json({
      error: "device_mismatch",
      message: "Esta conta está vinculada a outro computador.",
    });
  }

  req.userId = Number(session.userId);
  req.hwidHash = hwidHash;
  next();
}

async function initDb() {
  if (!pool) return;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS licenses (
      id BIGSERIAL PRIMARY KEY,
      key_hash TEXT UNIQUE NOT NULL,
      key_prefix TEXT NOT NULL,
      plan TEXT NOT NULL DEFAULT 'standard',
      note TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NULL,
      revoked_at TIMESTAMPTZ NULL
    );

    CREATE TABLE IF NOT EXISTS users (
      id BIGSERIAL PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      disabled_at TIMESTAMPTZ NULL,
      hwid_hash TEXT NULL
    );

    CREATE TABLE IF NOT EXISTS user_products (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      product_code TEXT NOT NULL,
      plan TEXT NOT NULL DEFAULT 'mensal',
      purchased_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      revoked_at TIMESTAMPTZ NULL,
      UNIQUE(user_id, product_code)
    );

    CREATE TABLE IF NOT EXISTS free_trial_claims (
      user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      claimed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL,
      activated_device_hash TEXT NULL
    );

    CREATE TABLE IF NOT EXISTS device_bindings (
      hwid_hash TEXT PRIMARY KEY,
      first_user_id BIGINT NOT NULL,
      first_bound_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE INDEX IF NOT EXISTS idx_device_bindings_first_user
      ON device_bindings(first_user_id);

    INSERT INTO device_bindings(hwid_hash, first_user_id, first_bound_at)
    SELECT DISTINCT ON (hwid_hash)
      hwid_hash,
      id,
      created_at
    FROM users
    WHERE hwid_hash IS NOT NULL
    ORDER BY hwid_hash, created_at ASC, id ASC
    ON CONFLICT (hwid_hash) DO NOTHING;

    CREATE TABLE IF NOT EXISTS loader_releases (
      id BIGSERIAL PRIMARY KEY,
      version TEXT NOT NULL,
      file_name TEXT NOT NULL,
      mime_type TEXT NOT NULL DEFAULT 'application/octet-stream',
      file_size BIGINT NOT NULL,
      sha256 TEXT NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      file_data BYTEA NOT NULL,
      uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      is_active BOOLEAN NOT NULL DEFAULT FALSE
    );

    CREATE TABLE IF NOT EXISTS community_configs (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      config_json JSONB NOT NULL,
      downloads BIGINT NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS support_conversations (
      id BIGSERIAL PRIMARY KEY,
      session_hash TEXT UNIQUE NOT NULL,
      contact_email TEXT NOT NULL DEFAULT '',
      contact_whatsapp TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_message_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE support_conversations
      ADD COLUMN IF NOT EXISTS contact_email TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS contact_whatsapp TEXT NOT NULL DEFAULT '';

    CREATE TABLE IF NOT EXISTS support_messages (
      id BIGSERIAL PRIMARY KEY,
      conversation_id BIGINT NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
      sender TEXT NOT NULL CHECK (sender IN ('visitor', 'admin')),
      body TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      read_at TIMESTAMPTZ NULL
    );

    CREATE TABLE IF NOT EXISTS customer_profiles (
      user_id BIGINT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      full_name TEXT NOT NULL,
      cpf TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT NOT NULL,
      process_number TEXT NOT NULL,
      billing_street TEXT NOT NULL DEFAULT '',
      billing_number TEXT NOT NULL DEFAULT '',
      billing_complement TEXT NOT NULL DEFAULT '',
      billing_city TEXT NOT NULL DEFAULT '',
      billing_state TEXT NOT NULL DEFAULT '',
      billing_zipcode TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE customer_profiles
      ADD COLUMN IF NOT EXISTS billing_street TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS billing_number TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS billing_complement TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS billing_city TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS billing_state TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS billing_zipcode TEXT NOT NULL DEFAULT '';

    CREATE TABLE IF NOT EXISTS checkout_payments (
      id BIGSERIAL PRIMARY KEY,
      user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL DEFAULT 'mercadopago',
      idempotency_key TEXT UNIQUE NOT NULL,
      provider_order_id TEXT UNIQUE NULL,
      provider_ref_id TEXT NULL,
      provider_external_id TEXT NULL,
      payment_method TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'creating',
      amount NUMERIC(12,2) NULL,
      installments INTEGER NOT NULL DEFAULT 1,
      buyer_name TEXT NOT NULL,
      buyer_cpf TEXT NOT NULL,
      buyer_email TEXT NOT NULL,
      buyer_phone TEXT NOT NULL,
      process_number TEXT NOT NULL,
      card_holder_name TEXT NULL,
      card_last4 TEXT NULL,
      card_expiry TEXT NULL,
      card_brand TEXT NULL,
      pix_copy_paste TEXT NULL,
      pix_expires_at TIMESTAMPTZ NULL,
      paid_at TIMESTAMPTZ NULL,
      reversed_at TIMESTAMPTZ NULL,
      access_granted_at TIMESTAMPTZ NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );

    ALTER TABLE checkout_payments
      ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'BRL',
      ADD COLUMN IF NOT EXISTS plan_key TEXT NULL,
      ADD COLUMN IF NOT EXISTS plan_name TEXT NULL,
      ADD COLUMN IF NOT EXISTS plan_days INTEGER NULL,
      ADD COLUMN IF NOT EXISTS plan_lifetime BOOLEAN NOT NULL DEFAULT FALSE,
      ADD COLUMN IF NOT EXISTS expected_amount NUMERIC(12,2) NULL,
      ADD COLUMN IF NOT EXISTS product_code TEXT NOT NULL DEFAULT 'cs2',
      ADD COLUMN IF NOT EXISTS product_platform TEXT NOT NULL DEFAULT 'windows';

    CREATE INDEX IF NOT EXISTS idx_checkout_payments_user_created
      ON checkout_payments(user_id, created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_checkout_payments_provider_order
      ON checkout_payments(provider_order_id);

    CREATE INDEX IF NOT EXISTS idx_community_configs_created
      ON community_configs(created_at DESC);

    CREATE INDEX IF NOT EXISTS idx_support_conversations_last_message
      ON support_conversations(last_message_at DESC);

    CREATE INDEX IF NOT EXISTS idx_support_messages_conversation
      ON support_messages(conversation_id, id ASC);

    ALTER TABLE loader_releases
      ADD COLUMN IF NOT EXISTS product_code TEXT NOT NULL DEFAULT 'cs2';

    CREATE INDEX IF NOT EXISTS idx_loader_releases_active
      ON loader_releases(product_code, is_active, uploaded_at DESC);

    ALTER TABLE users
      ADD COLUMN IF NOT EXISTS hwid_hash TEXT NULL;

    CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users(LOWER(username));
    CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));

    INSERT INTO app_settings(key, value)
    VALUES ('product_status', 'online')
    ON CONFLICT (key) DO NOTHING;

    INSERT INTO app_settings(key, value)
    VALUES ('status_message', 'Sistema disponível.')
    ON CONFLICT (key) DO NOTHING;
  `);

  // Atualização única da disponibilidade solicitada. Alterações futuras feitas
  // pelo painel permanecem intactas mesmo depois de reiniciar o serviço.
  await pool.query(`
    WITH first_apply AS (
      INSERT INTO app_settings(key, value)
      VALUES ('cf_availability_revision_20261110', 'applied')
      ON CONFLICT (key) DO NOTHING
      RETURNING key
    )
    INSERT INTO app_settings(key, value)
    SELECT item.key, item.value
    FROM (VALUES
      ('cf_android_status', 'online'),
      ('cf_android_message', 'Counter Flame para Android já está disponível.'),
      ('cf_ios_status', 'presale'),
      ('cf_ios_message', 'Pré-venda disponível para iOS. O aplicativo ainda não foi lançado e a compra não oferece acesso imediato. Data de lançamento a confirmar.')
    ) AS item(key, value)
    WHERE EXISTS (SELECT 1 FROM first_apply)
    ON CONFLICT (key)
    DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()
  `);
}

// Additive only: new tables, no change to existing data. Products added from the admin panel are reloaded at boot.
async function initRegistry() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS catalog_products (
      code TEXT PRIMARY KEY,
      definition JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE TABLE IF NOT EXISTS release_events (
      id BIGSERIAL PRIMARY KEY,
      product_code TEXT NOT NULL,
      release_id BIGINT NULL,
      event TEXT NOT NULL,
      detail TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);
  const rows = await pool.query("SELECT code, definition FROM catalog_products ORDER BY created_at ASC");
  for (const row of rows.rows) {
    try { if (!registry.has(row.code)) registry.register(row.code, row.definition); }
    catch (error) { console.error("catalog_products ignorado:", row.code, error.message); }
  }
}

async function releaseEvent(product, releaseId, event, detail = "") {
  try {
    await pool.query("INSERT INTO release_events(product_code, release_id, event, detail) VALUES($1,$2,$3,$4)", [product, releaseId, event, String(detail).slice(0, 500)]);
  } catch (error) { console.error("release_events:", error.message); }
}

async function setting(key, fallback) {
  if (!pool) return fallback;
  const result = await pool.query(
    "SELECT value FROM app_settings WHERE key = $1 LIMIT 1",
    [key]
  );
  return result.rows[0]?.value ?? fallback;
}

async function setSetting(key, value) {
  if (!pool) throw new Error("DATABASE_URL não configurada.");
  await pool.query(
    `INSERT INTO app_settings(key, value)
     VALUES ($1, $2)
     ON CONFLICT (key)
     DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
    [key, value]
  );
}

async function productStatus() {
  const status = await setting("product_status", "maintenance");
  const message = await setting(
    "status_message",
    pool ? "Sistema disponível." : "Banco de dados indisponível."
  );
  return { status, message };
}


const STATUS_VALUES = new Set(["online", "maintenance", "offline", "coming_soon", "presale"]);
const PRODUCT_STATUS_KEYS = Object.freeze({
  cs2: { status: "product_status", message: "status_message", allowed: ["online", "maintenance", "offline"] },
  counterFrameAndroid: { status: "cf_android_status", message: "cf_android_message", allowed: ["online", "maintenance", "offline", "coming_soon"] },
  counterFrameIos: { status: "cf_ios_status", message: "cf_ios_message", allowed: ["online", "maintenance", "offline", "coming_soon", "presale"] },
});

async function productStatuses() {
  const defaults = {
    product_status: "maintenance",
    status_message: "Status temporariamente indisponível.",
    cf_android_status: "online",
    cf_android_message: "Counter Flame para Android já está disponível.",
    cf_ios_status: "online",
    cf_ios_message: "Counter Flame para iOS disponível.",
  };

  let current = defaults;
  if (pool) {
    const result = await pool.query(
      "SELECT key, value FROM app_settings WHERE key = ANY($1::text[])",
      [Object.keys(defaults)]
    );
    current = { ...defaults, ...Object.fromEntries(result.rows.map(row => [row.key, row.value])) };
  }

  const read = (name, statusKey, messageKey) => ({
    name,
    status: STATUS_VALUES.has(current[statusKey]) ? current[statusKey] : defaults[statusKey],
    message: String(current[messageKey] || defaults[messageKey]),
  });
  return {
    cs2: read("CS2 — Windows", "product_status", "status_message"),
    counterFrameAndroid: read("Counter Flame — Android", "cf_android_status", "cf_android_message"),
    counterFrameIos: read("Counter Flame — iOS", "cf_ios_status", "cf_ios_message"),
  };
}

async function activeProductAccess(userId, product = PRODUCT_CODE) {
  if (!pool) return false;

  const result = await pool.query(
    `SELECT 1
     FROM user_products
     WHERE user_id = $1
       AND product_code = $2
       AND revoked_at IS NULL
       AND expires_at > NOW()
     LIMIT 1`,
    [userId, accessProductOf(product)]
  );

  return Boolean(result.rows[0]);
}

async function activeLoaderReleaseMeta(product = PRODUCT_CODE) {
  if (!pool) return null;

  const active = await pool.query(
    `SELECT id, version, file_name, mime_type, file_size, sha256, notes, uploaded_at
     FROM loader_releases
     WHERE is_active = TRUE AND product_code = $1
     ORDER BY uploaded_at DESC
     LIMIT 1`,
    [product]
  );

  if (active.rows[0]) {
    return active.rows[0];
  }

  const latest = await pool.query(
    `SELECT id, version, file_name, mime_type, file_size, sha256, notes, uploaded_at
     FROM loader_releases
     WHERE product_code = $1
     ORDER BY uploaded_at DESC
     LIMIT 1`,
    [product]
  );

  const release = latest.rows[0] || null;
  if (!release) {
    return null;
  }

  await pool.query(
    `UPDATE loader_releases
     SET is_active = (id = $1)
     WHERE product_code = $2`,
    [release.id, product]
  );

  return release;
}

async function nextLoaderVersion(product = PRODUCT_CODE) {
  if (!pool) return "1.0";

  const result = await pool.query(
    `SELECT version
     FROM loader_releases
     WHERE product_code = $1
     ORDER BY id DESC
     LIMIT 1`,
    [product]
  );

  const current = String(result.rows[0]?.version || "").trim();
  const match = /^(\d+)\.(\d+)$/.exec(current);

  if (!match) return "1.0";

  const major = Number(match[1]);
  const minor = Number(match[2]);

  if (!Number.isInteger(major) || !Number.isInteger(minor)) {
    return "1.0";
  }

  return major + "." + (minor + 1);
}

function sanitizeFileName(value) {
  const raw = String(value || "legitbaratinho-loader.zip").trim();
  const clean = raw.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  return clean || "legitbaratinho-loader.zip";
}

async function accountSnapshot(userId, product = PRODUCT_CODE) {
  if (!pool) throw new Error("database_not_configured");

  const userResult = await pool.query(
    `SELECT id, username, email, created_at
     FROM users
     WHERE id = $1 AND disabled_at IS NULL
     LIMIT 1`,
    [userId]
  );

  const user = userResult.rows[0];
  if (!user) return null;

  const productResult = await pool.query(
    `SELECT product_code, plan, purchased_at, expires_at, revoked_at
     FROM user_products
     WHERE user_id = $1 AND product_code = $2
     LIMIT 1`,
    [userId, product]
  );

  const trialResult = await pool.query(
    `SELECT claimed_at, expires_at, activated_device_hash
     FROM free_trial_claims
     WHERE user_id = $1
     LIMIT 1`,
    [userId]
  );

  const row = productResult.rows[0] || null;
  const trial = trialResult.rows[0] || null;

  // Every sellable product this user has acquired (active or expired), for the loader's product list.
  const ownedResult = await pool.query(
    `SELECT product_code, plan, purchased_at, expires_at, revoked_at
     FROM user_products
     WHERE user_id = $1 AND product_code = ANY($2)
     ORDER BY purchased_at ASC`,
    [userId, registry.sellable()]
  );
  const ownedNow = Date.now();
  const products = ownedResult.rows.map((r) => {
    const plan = String(r.plan || "");
    const isLifetime = plan.toLowerCase() === "lifetime";
    const exp = r.expires_at ? new Date(r.expires_at).getTime() : 0;
    const active = !r.revoked_at && (isLifetime || exp > ownedNow);
    return {
      code: r.product_code,
      name: PRODUCTS[r.product_code].name,
      hasAccess: active,
      plan: active ? plan : null,
      planLabel: active ? (plan.toLowerCase() === "free" ? "Teste grátis" : plan) : null,
      purchasedAt: r.purchased_at || null,
      expiresAt: isLifetime ? null : (r.expires_at || null),
      daysRemaining: active && !isLifetime ? Math.max(1, Math.ceil((exp - ownedNow) / 86400000)) : 0, // 0 for lifetime/expired: clients read `lifetime`
      lifetime: isLifetime,
    };
  });
  const now = Date.now();
  const expires = row?.expires_at ? new Date(row.expires_at).getTime() : 0;
  const normalizedPlan = String(row?.plan || "").toLowerCase();
  const lifetime = normalizedPlan === "lifetime";
  const isFreeTrial = normalizedPlan === "free";
  const hasAccess = Boolean(row) && !row.revoked_at && (lifetime || expires > now);
  const daysRemaining = hasAccess && !lifetime
    ? Math.max(1, Math.ceil((expires - now) / 86400000))
    : lifetime ? null : 0;

  return {
    user: {
      id: Number(user.id),
      username: user.username,
      email: user.email,
      createdAt: user.created_at,
    },
    product: {
      code: product,
      name: PRODUCTS[product].name,
      hasAccess,
      plan: hasAccess ? row.plan : null,
      planLabel: hasAccess
        ? (isFreeTrial ? "Teste grátis" : row.plan)
        : null,
      purchasedAt: row?.purchased_at || null,
      expiresAt: lifetime ? null : (row?.expires_at || null),
      daysRemaining,
      lifetime,
      isFreeTrial: hasAccess && isFreeTrial,
    },
    trial: {
      eligible: false,
      claimed: Boolean(trial),
      claimedAt: trial?.claimed_at || null,
      expiresAt: trial?.expires_at || null,
      deviceActivated: Boolean(trial?.activated_device_hash),
    },
    products,
    status: await productStatus(),
  };
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, database: Boolean(pool) });
});

app.get("/api/status", async (_req, res) => {
  try {
    res.json(await productStatus());
  } catch {
    res.status(503).json({
      status: "maintenance",
      message: "Status temporariamente indisponível.",
    });
  }
});

app.get("/api/product-statuses", async (_req, res) => {
  try {
    res.setHeader("Cache-Control", "no-store");
    res.json(await productStatuses());
  } catch (error) {
    console.error("Falha ao consultar status de produtos:", error?.message || error);
    res.status(503).json({ error: "status_unavailable" });
  }
});

app.post("/api/account/register", async (req, res) => {
  if (!pool) return res.status(503).json({ error: "database_not_configured" });

  const username = String(req.body?.username || "").trim();
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");

  if (!validUsername(username)) {
    return res.status(400).json({
      error: "invalid_username",
      message: "Use de 3 a 28 caracteres: letras, números, ponto, hífen ou underline.",
    });
  }

  if (!validEmail(email)) {
    return res.status(400).json({ error: "invalid_email", message: "Informe um e-mail válido." });
  }

  if (password.length < 8 || password.length > 128) {
    return res.status(400).json({
      error: "invalid_password",
      message: "A senha precisa ter pelo menos 8 caracteres.",
    });
  }

  try {
    const result = await pool.query(
      `INSERT INTO users(username, email, password_hash)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [username, email, passwordHash(password)]
    );

    const userId = Number(result.rows[0].id);
    const token = signSession({
      kind: "web",
      userId,
      exp: Date.now() + USER_SESSION_MS,
    });

    res.cookie(USER_COOKIE, token, {
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
      maxAge: USER_SESSION_MS,
    });

    res.status(201).json(await accountSnapshot(userId));
  } catch (error) {
    if (error?.code === "23505") {
      return res.status(409).json({
        error: "account_exists",
        message: "Usuário ou e-mail já cadastrado.",
      });
    }
    console.error(error);
    res.status(500).json({ error: "register_failed" });
  }
});

app.post("/api/account/login", async (req, res) => {
  if (!pool) return res.status(503).json({ error: "database_not_configured" });

  const identifier = String(req.body?.identifier || "").trim();
  const password = String(req.body?.password || "");

  const result = await pool.query(
    `SELECT id, password_hash
     FROM users
     WHERE disabled_at IS NULL
       AND (LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1))
     LIMIT 1`,
    [identifier]
  );

  const user = result.rows[0];
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({
      error: "invalid_credentials",
      message: "Usuário/e-mail ou senha incorretos.",
    });
  }

  const token = signSession({
    kind: "web",
    userId: Number(user.id),
    exp: Date.now() + USER_SESSION_MS,
  });

  res.cookie(USER_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: USER_SESSION_MS,
  });

  res.json(await accountSnapshot(Number(user.id)));
});

app.post("/api/account/logout", (_req, res) => {
  res.clearCookie(USER_COOKIE);
  res.json({ ok: true });
});

app.get("/api/account/me", requireUser, async (req, res) => {
  const snapshot = await accountSnapshot(req.userId, productOf(req));
  if (!snapshot) return res.status(401).json({ error: "account_unavailable" });
  res.json(snapshot);
});

// New free-trial claims were discontinued. Existing trials remain in the
// database for audit and their original expiry still applies.
app.post("/api/account/free-trial", requireUser, (_req, res) => {
  res.status(410).json({
    error: "free_trial_discontinued",
    message: "O teste grátis foi encerrado. Consulte os planos disponíveis."
  });
});

app.get("/api/loader/latest", async (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.setHeader("Surrogate-Control", "no-store");

  try {
    const release = await activeLoaderReleaseMeta(productOf(req));

    if (!release) {
      return res.status(204).end();
    }

    res.json({
      product: productOf(req),
      version: release.version,
      fileName: release.file_name,
      fileSize: Number(release.file_size),
      sha256: release.sha256,
      notes: release.notes,
      uploadedAt: release.uploaded_at,
    });
  } catch {
    res.status(503).json({
      error: "release_unavailable",
      message: "Não foi possível consultar atualizações.",
    });
  }
});

app.get("/api/loader/download", async (req, res) => {
  if (!pool) return res.status(503).send("Banco indisponível.");

  const hwid = String(req.headers["x-device-id"] || "").trim();
  if (!/^[a-f0-9]{64}$/i.test(hwid)) {
    return res.status(401).send("Dispositivo não identificado.");
  }

  const hwidHash = sha256(hwid);

  const access = await pool.query(
    `SELECT u.id
     FROM users u
     JOIN user_products p
       ON p.user_id = u.id
      AND p.product_code = $1
     WHERE u.disabled_at IS NULL
       AND u.hwid_hash = $2
       AND p.revoked_at IS NULL
       AND p.expires_at > NOW()
     LIMIT 1`,
    [accessProductOf(productOf(req)), hwidHash]
  );

  if (!access.rows[0]) {
    return res.status(403).send("Login necessário para autorizar a atualização.");
  }

  const result = await pool.query(
    `SELECT version, file_name, mime_type, file_size, sha256, file_data
     FROM loader_releases
     WHERE is_active = TRUE AND product_code = $1
     ORDER BY uploaded_at DESC
     LIMIT 1`,
    [productOf(req)]
  );

  const release = result.rows[0];
  if (!release) return res.status(404).send("Nenhuma versão publicada.");

  const fileName = sanitizeFileName(release.file_name);

  res.setHeader("Content-Type", release.mime_type || "application/octet-stream");
  res.setHeader("Content-Length", String(release.file_size));
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Loader-Version", release.version);
  res.setHeader("X-Content-SHA256", release.sha256);
  res.send(release.file_data);
});


app.get("/api/account/release", requireUser, async (req, res) => {
  if (!await activeProductAccess(req.userId, productOf(req))) {
    return res.status(403).json({
      error: "access_required",
      message: "Você precisa de um acesso ativo para baixar o loader.",
    });
  }

  const release = await activeLoaderReleaseMeta(productOf(req));

  if (!release) {
    return res.status(404).json({
      error: "release_unavailable",
      message: "Ainda não existe uma versão do loader publicada.",
    });
  }

  res.json({
    release: {
      id: Number(release.id),
      version: release.version,
      fileName: release.file_name,
      fileSize: Number(release.file_size),
      sha256: release.sha256,
      notes: release.notes,
      uploadedAt: release.uploaded_at,
      downloadUrl: "/api/account/download-loader",
    },
  });
});

app.get("/api/account/download-loader", requireUser, async (req, res) => {
  if (!await activeProductAccess(req.userId, productOf(req))) {
    return res.status(403).send("Acesso ativo necessário.");
  }

  const result = await pool.query(
    `SELECT version, file_name, mime_type, file_size, sha256, file_data
     FROM loader_releases
     WHERE is_active = TRUE AND product_code = $1
     ORDER BY uploaded_at DESC
     LIMIT 1`,
    [productOf(req)]
  );

  const release = result.rows[0];
  if (!release) return res.status(404).send("Nenhuma versão publicada.");

  const fileName = sanitizeFileName(release.file_name);

  res.setHeader("Content-Type", release.mime_type || "application/octet-stream");
  res.setHeader("Content-Length", String(release.file_size));
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Loader-Version", release.version);
  res.setHeader("X-Content-SHA256", release.sha256);
  res.send(release.file_data);
});

app.post("/api/client/login", async (req, res) => {
  if (!pool) return res.status(503).json({ error: "database_not_configured" });

  const identifier = String(req.body?.identifier || "").trim();
  const password = String(req.body?.password || "");
  const hwid = String(req.body?.hwid || "").trim();

  if (!/^[a-f0-9]{64}$/i.test(hwid)) {
    return res.status(400).json({
      error: "invalid_device",
      message: "Não foi possível identificar este computador.",
    });
  }

  const result = await pool.query(
    `SELECT id, password_hash, disabled_at
     FROM users
     WHERE LOWER(username) = LOWER($1) OR LOWER(email) = LOWER($1)
     LIMIT 1`,
    [identifier]
  );

  const user = result.rows[0];
  if (!user || !verifyPassword(password, user.password_hash)) {
    return res.status(401).json({
      error: "invalid_credentials",
      message: "Usuário/e-mail ou senha incorretos.",
    });
  }

  if (user.disabled_at) {
    return res.status(403).json({
      error: "account_banned",
      message: "Sua conta está bloqueada. Entre em contato com o suporte.",
    });
  }

  const hwidHash = sha256(hwid);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const lockedUserResult = await client.query(
      `SELECT id, disabled_at, hwid_hash
       FROM users
       WHERE id = $1
       FOR UPDATE`,
      [user.id]
    );

    const lockedUser = lockedUserResult.rows[0];
    if (!lockedUser || lockedUser.disabled_at) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        error: "account_banned",
        message: "Sua conta está bloqueada. Entre em contato com o suporte.",
      });
    }

    if (lockedUser.hwid_hash && !safeEqual(lockedUser.hwid_hash, hwidHash)) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        error: "hwid_mismatch",
        message: "Esta conta já está vinculada a outro computador. Solicite um reset de HWID.",
      });
    }

    const productResult = await client.query(
      `SELECT plan, expires_at, revoked_at
       FROM user_products
       WHERE user_id = $1 AND product_code = $2
       FOR UPDATE`,
      [user.id, productOf(req)]
    );

    const product = productResult.rows[0] || null;
    const productPlan = String(product?.plan || "").toLowerCase();
    const productExpires = product?.expires_at
      ? new Date(product.expires_at).getTime()
      : 0;
    const hasActiveAccess = Boolean(product) &&
      !product.revoked_at &&
      (productPlan === "lifetime" || productExpires > Date.now());
    const isFreePlan = hasActiveAccess && productPlan === "free";

    let trial = null;
    if (isFreePlan) {
      const trialResult = await client.query(
        `SELECT activated_device_hash
         FROM free_trial_claims
         WHERE user_id = $1
         FOR UPDATE`,
        [user.id]
      );

      trial = trialResult.rows[0] || null;

      if (
        trial?.activated_device_hash &&
        !safeEqual(trial.activated_device_hash, hwidHash)
      ) {
        await client.query("ROLLBACK");
        return res.status(403).json({
          error: "free_trial_device_mismatch",
          message: "O teste grátis desta conta já foi vinculado a outro computador.",
        });
      }
    }

    await client.query(
      `INSERT INTO device_bindings(hwid_hash, first_user_id, first_bound_at)
       VALUES ($1, $2, NOW())
       ON CONFLICT (hwid_hash) DO NOTHING`,
      [hwidHash, user.id]
    );

    const bindingResult = await client.query(
      `SELECT first_user_id
       FROM device_bindings
       WHERE hwid_hash = $1
       FOR UPDATE`,
      [hwidHash]
    );

    const binding = bindingResult.rows[0];
    if (
      isFreePlan &&
      binding &&
      Number(binding.first_user_id) !== Number(user.id)
    ) {
      await client.query("ROLLBACK");
      return res.status(403).json({
        error: "free_trial_device_used",
        message: "Este computador já foi vinculado a outra conta. O teste grátis é permitido apenas uma vez por PC.",
      });
    }

    if (!lockedUser.hwid_hash) {
      await client.query(
        "UPDATE users SET hwid_hash = $1 WHERE id = $2 AND hwid_hash IS NULL",
        [hwidHash, user.id]
      );
    }

    if (isFreePlan && trial) {
      await client.query(
        `UPDATE free_trial_claims
         SET activated_device_hash = COALESCE(activated_device_hash, $2)
         WHERE user_id = $1`,
        [user.id, hwidHash]
      );
    }

    await client.query("COMMIT");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
    }

    console.error("Falha no vínculo de dispositivo:", error);
    return res.status(500).json({
      error: "device_binding_failed",
      message: "Não foi possível validar o vínculo deste computador.",
    });
  } finally {
    client.release();
  }

  const userId = Number(user.id);
  const loginIp=req.ip || req.socket.remoteAddress || '';
  const loginCountry=await visitorCountry({headers:{},socket:{remoteAddress:loginIp}});
  await pool.query("INSERT INTO access_audit(user_id,product,event,ip,device_hash,language,country) VALUES($1,$6,'login',$2,$3,$4,$5)", [userId, loginIp, hwidHash, String(req.headers['accept-language']||'en').slice(0,20), loginCountry, productOf(req)]);
  const token = signSession({
    kind: "loader",
    userId,
    hwidHash,
    exp: Date.now() + CLIENT_SESSION_MS,
  });

  res.json({
    token,
    account: await accountSnapshot(userId, productOf(req)),
  });
});

app.get("/api/client/me", requireClient, async (req, res) => {
  const snapshot = await accountSnapshot(req.userId, productOf(req));
  if (!snapshot) return res.status(401).json({ error: "account_unavailable" });
  res.json(snapshot);
});

app.get("/api/client/community-configs", requireClient, async (req, res) => {
  if (!await activeProductAccess(req.userId)) {
    return res.status(403).json({
      error: "access_required",
      message: "Acesso ativo necessário para usar as configs da comunidade.",
    });
  }

  const result = await pool.query(
    `SELECT
       c.id,
       c.title,
       c.description,
       c.downloads,
       c.created_at,
       u.username AS author
     FROM community_configs c
     JOIN users u ON u.id = c.user_id
     WHERE u.disabled_at IS NULL
     ORDER BY c.created_at DESC
     LIMIT 100`
  );

  res.json({
    configs: result.rows.map((row) => ({
      id: Number(row.id),
      title: row.title,
      description: row.description,
      author: row.author,
      downloads: Number(row.downloads),
      createdAt: row.created_at,
    })),
  });
});

app.post("/api/client/community-configs", requireClient, async (req, res) => {
  if (!await activeProductAccess(req.userId)) {
    return res.status(403).json({
      error: "access_required",
      message: "Acesso ativo necessário para compartilhar configs.",
    });
  }

  const title = String(req.body?.title || "").trim().slice(0, 48);
  const description = String(req.body?.description || "").trim().slice(0, 180);
  const configJson = String(req.body?.configJson || "");

  if (title.length < 3) {
    return res.status(400).json({
      error: "invalid_title",
      message: "Use um nome com pelo menos 3 caracteres.",
    });
  }

  if (!configJson || Buffer.byteLength(configJson, "utf8") > 350 * 1024) {
    return res.status(400).json({
      error: "invalid_config",
      message: "A config está vazia ou é grande demais.",
    });
  }

  let parsed;
  try {
    parsed = JSON.parse(configJson);
  } catch {
    return res.status(400).json({
      error: "invalid_json",
      message: "A config não contém JSON válido.",
    });
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return res.status(400).json({
      error: "invalid_config",
      message: "Formato de config inválido.",
    });
  }

  const count = await pool.query(
    "SELECT COUNT(*)::int AS total FROM community_configs WHERE user_id = $1",
    [req.userId]
  );

  if (Number(count.rows[0]?.total || 0) >= 20) {
    return res.status(400).json({
      error: "config_limit",
      message: "Você atingiu o limite de 20 configs compartilhadas.",
    });
  }

  const result = await pool.query(
    `WITH inserted AS (
       INSERT INTO community_configs(user_id, title, description, config_json)
       VALUES ($1, $2, $3, $4::jsonb)
       RETURNING id, user_id, title, description, downloads, created_at
     )
     SELECT
       inserted.id,
       inserted.title,
       inserted.description,
       inserted.downloads,
       inserted.created_at,
       u.username AS author
     FROM inserted
     JOIN users u ON u.id = inserted.user_id`,
    [req.userId, title, description, configJson]
  );

  const row = result.rows[0];
  res.status(201).json({
    ok: true,
    config: {
      id: Number(row.id),
      title: row.title,
      description: row.description,
      author: row.author,
      downloads: Number(row.downloads),
      createdAt: row.created_at,
    },
  });
});

app.get("/api/client/community-configs/:id", requireClient, async (req, res) => {
  if (!await activeProductAccess(req.userId)) {
    return res.status(403).json({
      error: "access_required",
      message: "Acesso ativo necessário para baixar configs.",
    });
  }

  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "invalid_id" });
  }

  const result = await pool.query(
    `UPDATE community_configs c
     SET downloads = downloads + 1
     FROM users u
     WHERE c.id = $1
       AND u.id = c.user_id
       AND u.disabled_at IS NULL
     RETURNING
       c.id,
       c.title,
       c.description,
       c.config_json::text AS config_json,
       c.downloads,
       c.created_at,
       u.username AS author`,
    [id]
  );

  const row = result.rows[0];
  if (!row) {
    return res.status(404).json({
      error: "config_not_found",
      message: "Config não encontrada.",
    });
  }

  res.json({
    config: {
      id: Number(row.id),
      title: row.title,
      description: row.description,
      author: row.author,
      configJson: row.config_json,
      downloads: Number(row.downloads),
      createdAt: row.created_at,
    },
  });
});

app.delete("/api/client/community-configs/:id", requireClient, async (req, res) => {
  const id = Number(req.params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return res.status(400).json({ error: "invalid_id" });
  }

  const result = await pool.query(
    "DELETE FROM community_configs WHERE id = $1 AND user_id = $2 RETURNING id",
    [id, req.userId]
  );

  if (!result.rows[0]) {
    return res.status(404).json({
      error: "config_not_found",
      message: "Config não encontrada ou não pertence a você.",
    });
  }

  res.json({ ok: true });
});

app.get("/api/client/release", requireClient, async (req, res) => {
  if (!await activeProductAccess(req.userId, productOf(req))) {
    return res.status(403).json({
      error: "access_required",
      message: "Acesso ativo necessário para atualizar o loader.",
    });
  }

  const release = await activeLoaderReleaseMeta(productOf(req));

  if (!release) {
    return res.status(404).json({
      error: "release_unavailable",
      message: "Nenhuma versão publicada.",
    });
  }

  res.json({
    release: {
      id: Number(release.id),
      version: release.version,
      fileName: release.file_name,
      fileSize: Number(release.file_size),
      sha256: release.sha256,
      notes: release.notes,
      uploadedAt: release.uploaded_at,
      downloadUrl: "/api/client/download-loader",
      product: productOf(req),
    },
  });
});

app.get("/api/client/download-loader", requireClient, async (req, res) => {
  if (!await activeProductAccess(req.userId, productOf(req))) {
    return res.status(403).send("Acesso ativo necessário.");
  }

  const result = await pool.query(
    `SELECT version, file_name, mime_type, file_size, sha256, file_data
     FROM loader_releases
     WHERE is_active = TRUE AND product_code = $1
     ORDER BY uploaded_at DESC
     LIMIT 1`,
    [productOf(req)]
  );

  const release = result.rows[0];
  if (!release) return res.status(404).send("Nenhuma versão publicada.");

  const fileName = sanitizeFileName(release.file_name);

  res.setHeader("Content-Type", release.mime_type || "application/octet-stream");
  res.setHeader("Content-Length", String(release.file_size));
  res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
  res.setHeader("Cache-Control", "private, no-store");
  res.setHeader("X-Loader-Version", release.version);
  res.setHeader("X-Content-SHA256", release.sha256);
  res.setHeader("X-Product", productOf(req));
  res.send(release.file_data);
});

// One call for the loader's product list: every product this account owns, its license state and latest release.
// Expired or revoked products are listed (so the UI can say why) but never launchable and never expose a release.
app.get("/api/client/catalog", requireClient, async (req, res) => {
  const owned = await pool.query(
    `SELECT product_code, plan, purchased_at, expires_at, revoked_at
     FROM user_products
     WHERE user_id = $1 AND product_code = ANY($2)
     ORDER BY purchased_at ASC`,
    [req.userId, registry.sellable()]
  );
  const now = Date.now();
  const products = [];
  for (const r of owned.rows) {
    const def = registry.get(r.product_code);
    if (!def) continue;
    const plan = String(r.plan || "");
    const lifetime = plan.toLowerCase() === "lifetime";
    const exp = r.expires_at ? new Date(r.expires_at).getTime() : 0;
    const active = !r.revoked_at && (lifetime || exp > now);
    const release = active ? await activeLoaderReleaseMeta(r.product_code) : null;
    products.push({
      code: r.product_code,
      name: def.name,
      glyph: def.glyph,
      notice: def.notice,
      platform: def.platform,
      channel: def.channel,
      launch: { type: def.launch.type, requiresAdmin: def.launch.requiresAdmin },
      license: {
        status: r.revoked_at ? "revoked" : active ? "active" : "expired",
        plan: plan || null,
        expiresAt: lifetime ? null : (r.expires_at || null),
        daysRemaining: active && !lifetime ? Math.max(1, Math.ceil((exp - now) / 86400000)) : 0,
        lifetime,
      },
      release: release ? {
        version: release.version, size: Number(release.file_size), sha256: release.sha256,
        notes: release.notes, uploadedAt: release.uploaded_at,
      } : null,
      canLaunch: active && (def.launch.type === "in-process" || Boolean(release)),
    });
  }
  res.json({ products, status: await productStatus() });
});

// Signed manifest for one product. Never served unsigned: without a signing key the endpoint answers 503.
app.get("/api/client/manifest", requireClient, async (req, res) => {
  const product = strictProductOf(req);
  if (!product) return res.status(400).json({ error: "unknown_product" });
  if (!await activeProductAccess(req.userId, product)) {
    return res.status(403).json({ error: "access_required", message: "Acesso ativo necessário." });
  }
  const key = signingKeyPem();
  if (!key) return res.status(503).json({ error: "signing_not_configured" });
  const release = await activeLoaderReleaseMeta(product);
  if (!release) return res.status(404).json({ error: "release_unavailable", message: "Nenhuma versão publicada." });
  try {
    const signed = signManifest(buildManifest({ product, def: registry.get(product), release }), key);
    res.setHeader("Cache-Control", "private, no-store");
    res.json(signed);
  } catch (error) {
    console.error("manifest:", error.message);
    res.status(503).json({ error: "signing_failed" });
  }
});

app.post("/api/admin/login", (req, res) => {
  const configuredPassword = process.env.ADMIN_PASSWORD || "";
  if (!configuredPassword || !sessionSecret()) {
    return res.status(503).json({
      error: "admin_not_configured",
      message: "Defina ADMIN_PASSWORD e SESSION_SECRET no Railway.",
    });
  }

  if (!safeEqual(req.body?.password || "", configuredPassword)) {
    return res.status(401).json({ error: "invalid_credentials" });
  }

  const token = signSession({
    admin: true,
    exp: Date.now() + ADMIN_SESSION_MS,
  });

  res.cookie(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: ADMIN_SESSION_MS,
  });

  res.json({ ok: true });
});

app.post("/api/admin/logout", (_req, res) => {
  res.clearCookie(ADMIN_COOKIE);
  res.json({ ok: true });
});

app.get("/api/admin/me", requireAdmin, (_req, res) => {
  res.json({ authenticated: true });
});

app.get("/api/admin/releases", requireAdmin, async (req, res) => {
  if (!pool) return res.status(503).json({ error: "database_not_configured" });

  const result = await pool.query(
    `SELECT id, version, file_name, mime_type, file_size, sha256, notes, uploaded_at, is_active
     FROM loader_releases
     WHERE product_code = $1
     ORDER BY uploaded_at DESC
     LIMIT 30`,
    [productOf(req)]
  );

  res.json({
    releases: result.rows.map((row) => ({
      id: Number(row.id),
      version: row.version,
      fileName: row.file_name,
      mimeType: row.mime_type,
      fileSize: Number(row.file_size),
      sha256: row.sha256,
      notes: row.notes,
      uploadedAt: row.uploaded_at,
      isActive: Boolean(row.is_active),
    })),
  });
});

app.post(
  "/api/admin/releases/upload",
  requireAdmin,
  express.raw({ type: "*/*", limit: "250mb" }),
  async (req, res) => {
    if (!pool) return res.status(503).json({ error: "database_not_configured" });

    const file = req.body;
    if (!Buffer.isBuffer(file) || file.length === 0) {
      return res.status(400).json({
        error: "empty_file",
        message: "Selecione um arquivo do loader.",
      });
    }

    // Publishing never falls back to a default channel: the product must be named and known.
    const product = strictProductOf(req);
    if (!product) {
      return res.status(400).json({ error: "product_required", message: "Informe um produto válido para publicar." });
    }
    const fileName = sanitizeFileName(req.query.fileName);
    const report = inspectUpload(file, fileName, registry.get(product));
    if (!report.ok) {
      return res.status(422).json({ error: "validation_failed", errors: report.errors, message: "O arquivo não passou na verificação." });
    }
    const digest = report.sha256;
    // The same bytes already published in another product's channel are almost certainly a wrong-channel upload.
    const other = await pool.query("SELECT product_code FROM loader_releases WHERE sha256 = $1 AND product_code <> $2 LIMIT 1", [digest, product]);
    if (other.rows[0]) {
      return res.status(409).json({ error: "wrong_channel", message: "Este arquivo já foi publicado no canal " + other.rows[0].product_code + "." });
    }
    const version = await nextLoaderVersion(product);
    const notes = String(req.query.notes || "").trim().slice(0, 500);
    const mimeType = String(req.query.mimeType || "application/octet-stream").slice(0, 120);

    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await client.query("UPDATE loader_releases SET is_active = FALSE WHERE is_active = TRUE AND product_code = $1", [product]);

      const result = await client.query(
        `INSERT INTO loader_releases(
          version, file_name, mime_type, file_size, sha256, notes, file_data, is_active, product_code
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8)
        RETURNING id, version, file_name, file_size, sha256, notes, uploaded_at, is_active`,
        [version, fileName, mimeType, file.length, digest, notes, file, product]
      );

      await client.query("COMMIT");
      await releaseEvent(product, result.rows[0].id, "publish", "v" + version + " " + digest);
      res.status(201).json({ ok: true, release: result.rows[0] });
    } catch (error) {
      await client.query("ROLLBACK");
      console.error(error);
      res.status(500).json({
        error: "upload_failed",
        message: "Não foi possível publicar esta versão.",
      });
    } finally {
      client.release();
    }
  }
);

// Dry run: reports size, SHA-256, format and duplicates without writing anything.
app.post("/api/admin/releases/validate", requireAdmin, express.raw({ type: "*/*", limit: "250mb" }), async (req, res) => {
  const product = strictProductOf(req);
  if (!product) return res.status(400).json({ error: "product_required" });
  const report = inspectUpload(req.body, sanitizeFileName(req.query.fileName), registry.get(product));
  const dup = pool ? await pool.query("SELECT product_code, version FROM loader_releases WHERE sha256 = $1", [report.sha256]) : { rows: [] };
  res.json({ product, ...report, alreadyPublished: dup.rows.map((r) => ({ product: r.product_code, version: r.version })) });
});

app.get("/api/admin/products", requireAdmin, (_req, res) => {
  res.json({ products: Object.entries(registry.products).map(([code, def]) => ({ code, ...def })) });
});

// Registers a new product (or loader channel) without redeploying. Existing products cannot be overwritten.
app.post("/api/admin/products", requireAdmin, async (req, res) => {
  if (!pool) return res.status(503).json({ error: "database_not_configured" });
  const code = String(req.body?.code || "").trim().toLowerCase();
  let def;
  try {
    def = registry.register(code, req.body?.definition);
  } catch (error) {
    if (String(error.message).startsWith("invalid_product:")) return res.status(400).json({ error: error.message });
    throw error;
  }
  try {
    await pool.query("INSERT INTO catalog_products(code, definition) VALUES($1, $2)", [code, JSON.stringify(def)]);
  } catch (error) {
    delete registry.products[code];
    throw error;
  }
  await releaseEvent(code, null, "product_register", def.name);
  res.status(201).json({ ok: true, product: { code, ...def } });
});

app.get("/api/admin/signing-key", requireAdmin, (_req, res) => {
  const key = signingKeyPem();
  if (!key) return res.status(503).json({ error: "signing_not_configured" });
  res.json({ publicKeyPem: publicKeyOf(key) });
});

app.post("/api/admin/releases/:id/activate", requireAdmin, async (req, res) => {
  if (!pool) return res.status(503).json({ error: "database_not_configured" });

  const releaseId = Number(req.params.id);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const exists = await client.query(
      "SELECT product_code FROM loader_releases WHERE id = $1 LIMIT 1",
      [releaseId]
    );

    if (!exists.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "release_not_found" });
    }

    await client.query("UPDATE loader_releases SET is_active = FALSE WHERE is_active = TRUE AND product_code = $1", [exists.rows[0].product_code]);
    await client.query("UPDATE loader_releases SET is_active = TRUE WHERE id = $1", [releaseId]);
    await client.query("COMMIT");
    await releaseEvent(exists.rows[0].product_code, releaseId, "activate", "rollback/activate");

    res.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

app.delete("/api/admin/releases/:id", requireAdmin, async (req, res) => {
  if (!pool) return res.status(503).json({ error: "database_not_configured" });

  const releaseId = Number(req.params.id);
  const result = await pool.query(
    "DELETE FROM loader_releases WHERE id = $1 AND is_active = FALSE RETURNING id",
    [releaseId]
  );

  if (!result.rows[0]) {
    return res.status(400).json({
      error: "cannot_delete_active",
      message: "A versão ativa não pode ser excluída. Ative outra versão primeiro.",
    });
  }

  res.json({ ok: true });
});

app.get("/api/admin/clients", requireAdmin, async (req, res) => {
  if (!pool) return res.status(503).json({ error: "database_not_configured" });

  const result = await pool.query(`
    SELECT
      u.id,
      u.username,
      u.email,
      u.created_at,
      u.disabled_at,
      (u.hwid_hash IS NOT NULL) AS hwid_bound,
      p.plan,
      p.expires_at,
      p.revoked_at
    FROM users u
    LEFT JOIN LATERAL (
      SELECT plan, expires_at, revoked_at
      FROM user_products
      WHERE user_id = u.id AND product_code = ANY($1)
      ORDER BY (revoked_at IS NULL) DESC, expires_at DESC NULLS LAST
      LIMIT 1
    ) p ON TRUE
    ORDER BY u.id DESC
    LIMIT 500
  `, [String(req.query.game || "").toLowerCase() === "counterframe"
        ? ["counterframe-android", "counterframe-ios"]
        : [accessProductOf(productOf(req))]]);

  const now = Date.now();
  const clients = result.rows.map((row) => {
    const expires = row.expires_at ? new Date(row.expires_at).getTime() : 0;
    const active = Boolean(row.expires_at) && !row.revoked_at && expires > now;
    return {
      id: Number(row.id),
      username: row.username,
      email: row.email,
      createdAt: row.created_at,
      banned: Boolean(row.disabled_at),
      hwidBound: Boolean(row.hwid_bound),
      plan: active ? row.plan : null,
      expiresAt: row.expires_at,
      daysRemaining: active ? Math.max(1, Math.ceil((expires - now) / 86400000)) : 0,
      hasAccess: active,
    };
  });

  res.json({ clients });
});

app.post("/api/admin/clients/:id/add-days", requireAdmin, async (req, res) => {
  if (!pool) return res.status(503).json({ error: "database_not_configured" });

  const userId = Number(req.params.id);
  const days = Math.trunc(Number(req.body?.days || 0));
  const plan = String(req.body?.plan || "admin").slice(0, 40);

  if (!Number.isInteger(userId) || userId <= 0 || !Number.isInteger(days) || days < 1 || days > 3650) {
    return res.status(400).json({
      error: "invalid_days",
      message: "Informe uma quantidade entre 1 e 3650 dias.",
    });
  }

  const exists = await pool.query("SELECT 1 FROM users WHERE id = $1 LIMIT 1", [userId]);
  if (!exists.rows[0]) return res.status(404).json({ error: "client_not_found" });

  await pool.query(
    `INSERT INTO user_products(user_id, product_code, plan, purchased_at, expires_at, revoked_at)
     VALUES ($1, $2, $3, NOW(), NOW() + ($4 || ' days')::interval, NULL)
     ON CONFLICT (user_id, product_code)
     DO UPDATE SET
       expires_at = GREATEST(COALESCE(user_products.expires_at, NOW()), NOW()) + ($4 || ' days')::interval,
       revoked_at = NULL`,
    [userId, accessProductOf(productOf(req)), plan, String(days)]
  );

  res.json({ ok: true });
});

app.post("/api/admin/clients/:id/ban", requireAdmin, async (req, res) => {
  if (!pool) return res.status(503).json({ error: "database_not_configured" });
  const userId = Number(req.params.id);
  await pool.query("UPDATE users SET disabled_at = NOW() WHERE id = $1", [userId]);
  res.json({ ok: true });
});

app.post("/api/admin/clients/:id/unban", requireAdmin, async (req, res) => {
  if (!pool) return res.status(503).json({ error: "database_not_configured" });
  const userId = Number(req.params.id);
  await pool.query("UPDATE users SET disabled_at = NULL WHERE id = $1", [userId]);
  res.json({ ok: true });
});

app.post("/api/admin/clients/:id/reset-hwid", requireAdmin, async (req, res) => {
  if (!pool) return res.status(503).json({ error: "database_not_configured" });
  const userId = Number(req.params.id);
  await pool.query("UPDATE users SET hwid_hash = NULL WHERE id = $1", [userId]);
  res.json({ ok: true });
});

app.post("/api/admin/status", requireAdmin, async (req, res) => {
  const allowed = new Set(["online", "maintenance", "offline"]);
  const status = String(req.body?.status || "");
  const message = String(req.body?.message || "").slice(0, 220);

  if (!allowed.has(status)) {
    return res.status(400).json({ error: "invalid_status" });
  }

  await setSetting("product_status", status);
  await setSetting("status_message", message || "Status atualizado.");
  res.json({ ok: true, status, message });
});

app.post("/api/admin/product-statuses/:product", requireAdmin, async (req, res) => {
  if (!pool) return res.status(503).json({ error: "database_not_configured" });

  const config = PRODUCT_STATUS_KEYS[String(req.params.product || "")];
  if (!config) return res.status(404).json({ error: "unknown_product" });

  const status = String(req.body?.status || "");
  const message = String(req.body?.message || "").trim().slice(0, 220);
  if (!config.allowed.includes(status) || !message) {
    return res.status(400).json({ error: "invalid_status_or_message" });
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO app_settings(key, value)
       VALUES ($1, $2), ($3, $4)
       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()`,
      [config.status, status, config.message, message]
    );
    await client.query("COMMIT");
    res.json({ ok: true, product: req.params.product, status, message });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Falha ao atualizar status:", error?.message || error);
    res.status(500).json({ error: "status_save_failed" });
  } finally {
    client.release();
  }
});

registerCounterframe(app, {pool, requireUser, requireAdmin, verifyPassword, passwordHash, validUsername, validEmail, setting, setSetting});
registerTelegram(app, {pool});
registerTelegramAdmin(app, {pool, requireAdmin});
registerCoupons(app, {pool, requireAdmin});
registerReferrals(app, {pool, requireUser});
registerCheckoutRoutes(app, {
  pool,
  requireUser,
  optionalUser,
  accountSnapshot,
  productCode: PRODUCT_CODE,
});

registerSupportRoutes(app, {
  pool,
  requireAdmin,
});

app.get("/admin", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("/api/account/counterframe", requireUser, async (req, res) => {
  if (!pool) return res.status(503).json({ error: "database_not_configured" });
  try {
    const access = await pool.query(
      `SELECT product_code,plan,purchased_at,expires_at,revoked_at
       FROM user_products
       WHERE user_id=$1 AND product_code IN ('counterframe-android','counterframe-ios')
       ORDER BY purchased_at DESC`, [req.userId]
    );
    const preorders = await pool.query(
      `SELECT id,plan_name,plan_days,created_at,paid_at,status
       FROM checkout_payments
       WHERE user_id=$1 AND product_code='counterframe-ios' AND status='paid'
       ORDER BY paid_at DESC LIMIT 20`, [req.userId]
    );
    res.json({ access: access.rows, preorders: preorders.rows });
  } catch(error) {
    console.error("Falha ao consultar Counter Flame:",error?.message||error);
    res.status(500).json({error:"counterframe_account_failed"});
  }
});

app.get("/api/admin/counterframe/preorders", requireAdmin, async (_req,res) => {
  if (!pool) return res.status(503).json({error:"database_not_configured"});
  try {
    const result = await pool.query(
      `SELECT cp.id,cp.plan_name,cp.plan_days,cp.paid_at,cp.access_granted_at,
              u.username,u.email
       FROM checkout_payments cp JOIN users u ON u.id=cp.user_id
       WHERE cp.product_code='counterframe-ios' AND cp.status='paid'
       ORDER BY cp.paid_at DESC LIMIT 200`
    );
    res.json({preorders:result.rows});
  } catch(error) {
    console.error("Erro ao listar pré-vendas:",error?.message||error);
    res.status(500).json({error:"preorders_failed"});
  }
});

registerAdminStats(app, { pool, requireAdmin });

app.get("/api/catalog", (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  res.json(PRODUCT_CATALOG);
});

app.get("/produto/:slug", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "produto.html"));
});

app.get("/account", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "account.html"));
});

app.get("/checkout", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "checkout.html"));
});

app.get("/telegram-admin", (_req, res) => {
  res.redirect(302, "/admin.html#counterframe-telegram");
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

initDb()
  .then(() => pool && initCounterframe(pool))
  .then(() => pool && initTelegram(pool))
  .then(() => pool && initCoupons(pool))
  .then(() => pool && initReferrals(pool))
  .then(() => pool && initTerms(pool))
  .then(() => pool && initRegistry())
  .then(() => {
    app.listen(port, "0.0.0.0", () => {
      console.log(`legitbaratinho.xyz web ouvindo na porta ${port}`);
    });
  })
  .catch((error) => {
    console.error("Falha ao inicializar banco:", error);
    app.listen(port, "0.0.0.0");
  });

