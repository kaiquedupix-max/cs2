import express from "express";
import cookieParser from "cookie-parser";
import crypto from "node:crypto";
import pg from "pg";
import path from "node:path";
import { fileURLToPath } from "node:url";

const { Pool } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const port = Number(process.env.PORT || 3000);

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === "true"
        ? { rejectUnauthorized: false }
        : undefined,
    })
  : null;

app.disable("x-powered-by");
app.use(express.json({ limit: "64kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public"), {
  maxAge: process.env.NODE_ENV === "production" ? "1h" : 0,
}));

const ADMIN_COOKIE = "lb_admin";
const SESSION_TTL_SECONDS = 60 * 60 * 12;

function hash(text) {
  return crypto.createHash("sha256").update(text).digest("hex");
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

function requireAdmin(req, res, next) {
  const session = verifySession(req.cookies?.[ADMIN_COOKIE]);
  if (!session?.admin) return res.status(401).json({ error: "unauthorized" });
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

    INSERT INTO app_settings(key, value)
    VALUES ('product_status', 'online')
    ON CONFLICT (key) DO NOTHING;

    INSERT INTO app_settings(key, value)
    VALUES ('status_message', 'Todos os sistemas operacionais.')
    ON CONFLICT (key) DO NOTHING;
  `);
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

function generateLicenseKey() {
  const raw = crypto.randomBytes(18).toString("hex").toUpperCase();
  return [
    "LBT",
    raw.slice(0, 6),
    raw.slice(6, 12),
    raw.slice(12, 18),
    raw.slice(18, 24),
  ].join("-");
}

app.get("/health", (_req, res) => {
  res.json({ ok: true, database: Boolean(pool) });
});

app.get("/api/status", async (_req, res) => {
  try {
    const status = await setting("product_status", "maintenance");
    const message = await setting(
      "status_message",
      pool ? "Sistema disponível." : "Banco de dados ainda não configurado."
    );
    res.json({ status, message });
  } catch {
    res.status(503).json({
      status: "maintenance",
      message: "Status temporariamente indisponível.",
    });
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
    exp: Date.now() + SESSION_TTL_SECONDS * 1000,
  });

  res.cookie(ADMIN_COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: process.env.NODE_ENV === "production",
    maxAge: SESSION_TTL_SECONDS * 1000,
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

app.get("/api/admin/licenses", requireAdmin, async (_req, res) => {
  if (!pool) return res.status(503).json({ error: "database_not_configured" });
  const result = await pool.query(`
    SELECT id, key_prefix, plan, note, created_at, expires_at, revoked_at
    FROM licenses
    ORDER BY id DESC
    LIMIT 250
  `);
  res.json({ licenses: result.rows });
});

app.post("/api/admin/licenses", requireAdmin, async (req, res) => {
  if (!pool) return res.status(503).json({ error: "database_not_configured" });

  const plan = String(req.body?.plan || "standard").slice(0, 40);
  const note = String(req.body?.note || "").slice(0, 180);
  const days = Number(req.body?.days || 30);
  const expiresAt = Number.isFinite(days) && days > 0
    ? new Date(Date.now() + days * 86400000)
    : null;

  const licenseKey = generateLicenseKey();
  const keyHash = hash(licenseKey);
  const keyPrefix = licenseKey.slice(0, 14) + "…";

  const result = await pool.query(
    `INSERT INTO licenses(key_hash, key_prefix, plan, note, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, key_prefix, plan, note, created_at, expires_at, revoked_at`,
    [keyHash, keyPrefix, plan, note, expiresAt]
  );

  res.status(201).json({
    license: result.rows[0],
    key: licenseKey,
    warning: "A chave completa é exibida somente agora.",
  });
});

app.post("/api/admin/licenses/:id/revoke", requireAdmin, async (req, res) => {
  if (!pool) return res.status(503).json({ error: "database_not_configured" });
  await pool.query(
    "UPDATE licenses SET revoked_at = NOW() WHERE id = $1",
    [req.params.id]
  );
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

app.post("/api/licenses/validate", async (req, res) => {
  if (!pool) return res.status(503).json({ valid: false });
  const licenseKey = String(req.body?.key || "").trim().toUpperCase();
  if (!licenseKey) return res.status(400).json({ valid: false });

  const result = await pool.query(
    `SELECT plan, expires_at, revoked_at
     FROM licenses
     WHERE key_hash = $1
     LIMIT 1`,
    [hash(licenseKey)]
  );

  const license = result.rows[0];
  const valid =
    Boolean(license) &&
    !license.revoked_at &&
    (!license.expires_at || new Date(license.expires_at) > new Date());

  res.json({
    valid,
    plan: valid ? license.plan : null,
    expiresAt: valid ? license.expires_at : null,
  });
});

app.get("/admin", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

initDb()
  .then(() => {
    app.listen(port, "0.0.0.0", () => {
      console.log(`legitbaratinho.xyz web ouvindo na porta ${port}`);
    });
  })
  .catch((error) => {
    console.error("Falha ao inicializar banco:", error);
    app.listen(port, "0.0.0.0");
  });
