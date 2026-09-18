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

    CREATE INDEX IF NOT EXISTS idx_loader_releases_active
      ON loader_releases(is_active, uploaded_at DESC);

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

async function activeProductAccess(userId) {
  if (!pool) return false;

  const result = await pool.query(
    `SELECT 1
     FROM user_products
     WHERE user_id = $1
       AND product_code = $2
       AND revoked_at IS NULL
       AND expires_at > NOW()
     LIMIT 1`,
    [userId, PRODUCT_CODE]
  );

  return Boolean(result.rows[0]);
}

async function activeLoaderReleaseMeta() {
  if (!pool) return null;

  const result = await pool.query(
    `SELECT id, version, file_name, mime_type, file_size, sha256, notes, uploaded_at
     FROM loader_releases
     WHERE is_active = TRUE
     ORDER BY uploaded_at DESC
     LIMIT 1`
  );

  return result.rows[0] || null;
}

function sanitizeFileName(value) {
  const raw = String(value || "legitbaratinho-loader.zip").trim();
  const clean = raw.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120);
  return clean || "legitbaratinho-loader.zip";
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

app.get("/api/account/release", requireUser, async (req, res) => {
  if (!await activeProductAccess(req.userId)) {
    return res.status(403).json({
      error: "access_required",
      message: "Você precisa de um acesso ativo para baixar o loader.",
    });
  }

  const release = await activeLoaderReleaseMeta();

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
  if (!await activeProductAccess(req.userId)) {
    return res.status(403).send("Acesso ativo necessário.");
  }

  const result = await pool.query(
    `SELECT version, file_name, mime_type, file_size, sha256, file_data
     FROM loader_releases
     WHERE is_active = TRUE
     ORDER BY uploaded_at DESC
     LIMIT 1`
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
    `SELECT id, password_hash, disabled_at, hwid_hash
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

  if (user.hwid_hash && !safeEqual(user.hwid_hash, hwidHash)) {
    return res.status(403).json({
      error: "hwid_mismatch",
      message: "Esta conta já está vinculada a outro computador. Solicite um reset de HWID.",
    });
  }

  if (!user.hwid_hash) {
    await pool.query(
      "UPDATE users SET hwid_hash = $1 WHERE id = $2 AND hwid_hash IS NULL",
      [hwidHash, user.id]
    );
  }

  const userId = Number(user.id);
  const token = signSession({
    kind: "loader",
    userId,
    hwidHash,
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

app.get("/api/admin/releases", requireAdmin, async (_req, res) => {
  if (!pool) return res.status(503).json({ error: "database_not_configured" });

  const result = await pool.query(
    `SELECT id, version, file_name, mime_type, file_size, sha256, notes, uploaded_at, is_active
     FROM loader_releases
     ORDER BY uploaded_at DESC
     LIMIT 30`
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
  express.raw({ type: "*/*", limit: "100mb" }),
  async (req, res) => {
    if (!pool) return res.status(503).json({ error: "database_not_configured" });

    const file = req.body;
    if (!Buffer.isBuffer(file) || file.length === 0) {
      return res.status(400).json({
        error: "empty_file",
        message: "Selecione um arquivo do loader.",
      });
    }

    const version = String(req.query.version || "").trim().slice(0, 60);
    const notes = String(req.query.notes || "").trim().slice(0, 500);
    const fileName = sanitizeFileName(req.query.fileName);
    const mimeType = String(req.query.mimeType || "application/octet-stream").slice(0, 120);

    if (!version) {
      return res.status(400).json({
        error: "version_required",
        message: "Informe a versão do loader.",
      });
    }

    const digest = sha256(file);
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await client.query("UPDATE loader_releases SET is_active = FALSE WHERE is_active = TRUE");

      const result = await client.query(
        `INSERT INTO loader_releases(
          version, file_name, mime_type, file_size, sha256, notes, file_data, is_active
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE)
        RETURNING id, version, file_name, file_size, sha256, notes, uploaded_at, is_active`,
        [version, fileName, mimeType, file.length, digest, notes, file]
      );

      await client.query("COMMIT");
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

app.post("/api/admin/releases/:id/activate", requireAdmin, async (req, res) => {
  if (!pool) return res.status(503).json({ error: "database_not_configured" });

  const releaseId = Number(req.params.id);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const exists = await client.query(
      "SELECT 1 FROM loader_releases WHERE id = $1 LIMIT 1",
      [releaseId]
    );

    if (!exists.rows[0]) {
      await client.query("ROLLBACK");
      return res.status(404).json({ error: "release_not_found" });
    }

    await client.query("UPDATE loader_releases SET is_active = FALSE WHERE is_active = TRUE");
    await client.query("UPDATE loader_releases SET is_active = TRUE WHERE id = $1", [releaseId]);
    await client.query("COMMIT");

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

app.get("/api/admin/clients", requireAdmin, async (_req, res) => {
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
    LEFT JOIN user_products p
      ON p.user_id = u.id
      AND p.product_code = $1
    ORDER BY u.id DESC
    LIMIT 500
  `, [PRODUCT_CODE]);

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
    [userId, PRODUCT_CODE, plan, String(days)]
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
