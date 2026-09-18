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

const ADMIN_COOKIE = "lb_admin";
const USER_COOKIE = "lb_user";
const ADMIN_SESSION_MS = 12 * 60 * 60 * 1000;
const USER_SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const CLIENT_SESSION_MS = 12 * 60 * 60 * 1000;
const PRODUCT_CODE = "cs2";

app.disable("x-powered-by");
app.use(express.json({ limit: "64kb" }));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public"), {
  maxAge: process.env.NODE_ENV === "production" ? "1h" : 0,
}));

function sha256(text) {
  return crypto.createHash("sha256").update(String(text)).digest("hex");
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

function requireUser(req, res, next) {
  const session = verifySession(req.cookies?.[USER_COOKIE]);
  if (!session?.userId || session?.kind !== "web") {
    return res.status(401).json({ error: "unauthorized" });
  }
  req.userId = Number(session.userId);
  next();
}

function requireClient(req, res, next) {
  const header = String(req.headers.authorization || "");
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  const session = verifySession(token);
  if (!session?.userId || session?.kind !== "loader") {
    return res.status(401).json({ error: "unauthorized" });
  }
  req.userId = Number(session.userId);
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
      disabled_at TIMESTAMPTZ NULL
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

    CREATE INDEX IF NOT EXISTS idx_users_username_lower ON users(LOWER(username));
    CREATE INDEX IF NOT EXISTS idx_users_email_lower ON users(LOWER(email));

    INSERT INTO app_settings(key, value)
    VALUES ('product_status', 'online')
    ON CONFLICT (key) DO NOTHING;

    INSERT INTO app_settings(key, value)
    VALUES ('status_message', 'Sistema disponível.')
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

async function productStatus() {
  const status = await setting("product_status", "maintenance");
  const message = await setting(
    "status_message",
    pool ? "Sistema disponível." : "Banco de dados indisponível."
  );
  return { status, message };
}

async function accountSnapshot(userId) {
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
    [userId, PRODUCT_CODE]
  );

  const row = productResult.rows[0] || null;
  const now = Date.now();
  const expires = row?.expires_at ? new Date(row.expires_at).getTime() : 0;
  const hasAccess = Boolean(row) && !row.revoked_at && expires > now;
  const daysRemaining = hasAccess
    ? Math.max(1, Math.ceil((expires - now) / 86400000))
    : 0;

  return {
    user: {
      id: Number(user.id),
      username: user.username,
      email: user.email,
      createdAt: user.created_at,
    },
    product: {
      code: PRODUCT_CODE,
      name: "Counter-Strike 2",
      hasAccess,
      plan: hasAccess ? row.plan : null,
      purchasedAt: row?.purchased_at || null,
      expiresAt: row?.expires_at || null,
      daysRemaining,
    },
    status: await productStatus(),
  };
}

function generateLicenseKey() {
  const raw = crypto.randomBytes(18).toString("hex").toUpperCase();
  return ["LBT", raw.slice(0, 6), raw.slice(6, 12), raw.slice(12, 18), raw.slice(18, 24)].join("-");
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
  const snapshot = await accountSnapshot(req.userId);
  if (!snapshot) return res.status(401).json({ error: "account_unavailable" });
  res.json(snapshot);
});

app.post("/api/account/purchase-simulated", requireUser, async (req, res) => {
  if (!pool) return res.status(503).json({ error: "database_not_configured" });

  const days = 30;
  const plan = "mensal-teste";

  await pool.query(
    `INSERT INTO user_products(user_id, product_code, plan, purchased_at, expires_at, revoked_at)
     VALUES ($1, $2, $3, NOW(), NOW() + ($4 || ' days')::interval, NULL)
     ON CONFLICT (user_id, product_code)
     DO UPDATE SET
       plan = EXCLUDED.plan,
       purchased_at = NOW(),
       expires_at =
         GREATEST(user_products.expires_at, NOW()) + ($4 || ' days')::interval,
       revoked_at = NULL`,
    [req.userId, PRODUCT_CODE, plan, String(days)]
  );

  res.json({
    ok: true,
    simulated: true,
    account: await accountSnapshot(req.userId),
  });
});

app.post("/api/client/login", async (req, res) => {
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

  const userId = Number(user.id);
  const token = signSession({
    kind: "loader",
    userId,
    exp: Date.now() + CLIENT_SESSION_MS,
  });

  res.json({
    token,
    account: await accountSnapshot(userId),
  });
});

app.get("/api/client/me", requireClient, async (req, res) => {
  const snapshot = await accountSnapshot(req.userId);
  if (!snapshot) return res.status(401).json({ error: "account_unavailable" });
  res.json(snapshot);
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
  const keyHash = sha256(licenseKey);
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
  await pool.query("UPDATE licenses SET revoked_at = NOW() WHERE id = $1", [req.params.id]);
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

app.get("/admin", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("/account", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "account.html"));
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
