import crypto from "node:crypto";

const SUPPORT_COOKIE = "lb_support";
const SUPPORT_COOKIE_MS = 180 * 24 * 60 * 60 * 1000;

function supportToken(req, res) {
  let token = String(req.cookies?.[SUPPORT_COOKIE] || "").trim();

  if (!/^[A-Za-z0-9_-]{24,120}$/.test(token)) {
    token = crypto.randomBytes(32).toString("base64url");
    res.cookie(SUPPORT_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: SUPPORT_COOKIE_MS,
    });
  }

  return token;
}

function sessionHash(token) {
  return crypto.createHash("sha256").update("support:" + token).digest("hex");
}

function cleanMessage(value) {
  const message = String(value || "").trim().slice(0, 1200);
  if (!message) {
    throw Object.assign(new Error("Digite uma mensagem."), { statusCode: 400 });
  }
  return message;
}

function cleanEmail(value) {
  const email = String(value || "").trim().toLowerCase().slice(0, 160);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw Object.assign(new Error("Informe um e-mail válido."), { statusCode: 400 });
  }
  return email;
}

function cleanWhatsapp(value) {
  let digits = String(value || "").replace(/\D/g, "");

  if ((digits.length === 10 || digits.length === 11) && !digits.startsWith("55")) {
    digits = "55" + digits;
  }

  if (digits.length < 12 || digits.length > 15) {
    throw Object.assign(new Error("Informe um WhatsApp válido com DDD."), { statusCode: 400 });
  }

  return digits;
}

export function registerSupportRoutes(app, deps) {
  const { pool, requireAdmin } = deps;

  async function conversationForRequest(req, res, create = false) {
    if (!pool) return null;

    const token = supportToken(req, res);
    const hash = sessionHash(token);

    const existing = await pool.query(
      `SELECT id, contact_email, contact_whatsapp, status, created_at, last_message_at
       FROM support_conversations
       WHERE session_hash = $1
       LIMIT 1`,
      [hash]
    );

    if (existing.rows[0] || !create) {
      return existing.rows[0] || null;
    }

    const created = await pool.query(
      `INSERT INTO support_conversations(session_hash, contact_email, contact_whatsapp, status, created_at, last_message_at)
       VALUES ($1, '', '', 'open', NOW(), NOW())
       ON CONFLICT (session_hash)
       DO UPDATE SET last_message_at = support_conversations.last_message_at
       RETURNING id, contact_email, contact_whatsapp, status, created_at, last_message_at`,
      [hash]
    );

    return created.rows[0] || null;
  }

  app.post("/api/support/contact", async (req, res) => {
    if (!pool) return res.status(503).json({ error: "database_not_configured" });

    try {
      const email = cleanEmail(req.body?.email);
      const whatsapp = cleanWhatsapp(req.body?.whatsapp);
      const conversation = await conversationForRequest(req, res, true);

      const updated = await pool.query(
        `UPDATE support_conversations
         SET contact_email = $2,
             contact_whatsapp = $3,
             last_message_at = GREATEST(last_message_at, NOW())
         WHERE id = $1
         RETURNING id, contact_email, contact_whatsapp, status, created_at, last_message_at`,
        [conversation.id, email, whatsapp]
      );

      const row = updated.rows[0];
      res.json({
        ok: true,
        contact: {
          email: row.contact_email,
          whatsapp: row.contact_whatsapp,
        },
      });
    } catch (error) {
      res.status(error?.statusCode || 500).json({
        error: "support_contact_failed",
        message: error?.message || "Não foi possível salvar seus dados de contato.",
      });
    }
  });

  app.get("/api/support/messages", async (req, res) => {
    if (!pool) return res.status(503).json({ error: "database_not_configured" });

    const conversation = await conversationForRequest(req, res, false);
    if (!conversation) {
      return res.json({ conversation: null, messages: [] });
    }

    const result = await pool.query(
      `SELECT id, sender, body, created_at, read_at
       FROM support_messages
       WHERE conversation_id = $1
       ORDER BY id ASC
       LIMIT 250`,
      [conversation.id]
    );

    await pool.query(
      `UPDATE support_messages
       SET read_at = COALESCE(read_at, NOW())
       WHERE conversation_id = $1 AND sender = 'admin'`,
      [conversation.id]
    );

    res.json({
      conversation: {
        id: Number(conversation.id),
        status: conversation.status,
        createdAt: conversation.created_at,
        lastMessageAt: conversation.last_message_at,
        contact: {
          email: conversation.contact_email || "",
          whatsapp: conversation.contact_whatsapp || "",
        },
      },
      messages: result.rows.map((row) => ({
        id: Number(row.id),
        sender: row.sender,
        body: row.body,
        createdAt: row.created_at,
        readAt: row.read_at,
      })),
    });
  });

  app.post("/api/support/messages", async (req, res) => {
    if (!pool) return res.status(503).json({ error: "database_not_configured" });

    try {
      const body = cleanMessage(req.body?.message);
      const conversation = await conversationForRequest(req, res, true);

      if (!conversation.contact_email || !conversation.contact_whatsapp) {
        return res.status(400).json({
          error: "contact_required",
          message: "Informe seu e-mail e WhatsApp antes de enviar a primeira mensagem.",
        });
      }

      const inserted = await pool.query(
        `INSERT INTO support_messages(conversation_id, sender, body)
         VALUES ($1, 'visitor', $2)
         RETURNING id, sender, body, created_at, read_at`,
        [conversation.id, body]
      );

      await pool.query(
        `UPDATE support_conversations
         SET status = 'open', last_message_at = NOW()
         WHERE id = $1`,
        [conversation.id]
      );

      const row = inserted.rows[0];
      res.status(201).json({
        conversationId: Number(conversation.id),
        message: {
          id: Number(row.id),
          sender: row.sender,
          body: row.body,
          createdAt: row.created_at,
          readAt: row.read_at,
        },
      });
    } catch (error) {
      res.status(error?.statusCode || 500).json({
        error: "support_message_failed",
        message: error?.message || "Não foi possível enviar a mensagem.",
      });
    }
  });

  app.get("/api/admin/support/conversations", requireAdmin, async (_req, res) => {
    if (!pool) return res.status(503).json({ error: "database_not_configured" });

    const result = await pool.query(
      `SELECT
         c.id,
         c.contact_email,
         c.contact_whatsapp,
         c.status,
         c.created_at,
         c.last_message_at,
         COALESCE(last_msg.body, '') AS last_message,
         COALESCE(unread.total, 0)::int AS unread
       FROM support_conversations c
       LEFT JOIN LATERAL (
         SELECT body
         FROM support_messages
         WHERE conversation_id = c.id
         ORDER BY id DESC
         LIMIT 1
       ) last_msg ON TRUE
       LEFT JOIN LATERAL (
         SELECT COUNT(*) AS total
         FROM support_messages
         WHERE conversation_id = c.id
           AND sender = 'visitor'
           AND read_at IS NULL
       ) unread ON TRUE
       ORDER BY c.last_message_at DESC
       LIMIT 250`
    );

    res.json({
      conversations: result.rows.map((row) => ({
        id: Number(row.id),
        status: row.status,
        createdAt: row.created_at,
        lastMessageAt: row.last_message_at,
        lastMessage: row.last_message,
        email: row.contact_email || "",
        whatsapp: row.contact_whatsapp || "",
        unread: Number(row.unread || 0),
      })),
    });
  });

  app.get("/api/admin/support/conversations/:id/messages", requireAdmin, async (req, res) => {
    if (!pool) return res.status(503).json({ error: "database_not_configured" });

    const conversationId = Number(req.params.id);
    if (!Number.isInteger(conversationId) || conversationId <= 0) {
      return res.status(400).json({ error: "invalid_conversation" });
    }

    const exists = await pool.query(
      `SELECT id, contact_email, contact_whatsapp, status, created_at, last_message_at
       FROM support_conversations
       WHERE id = $1
       LIMIT 1`,
      [conversationId]
    );

    if (!exists.rows[0]) {
      return res.status(404).json({ error: "conversation_not_found" });
    }

    const result = await pool.query(
      `SELECT id, sender, body, created_at, read_at
       FROM support_messages
       WHERE conversation_id = $1
       ORDER BY id ASC
       LIMIT 500`,
      [conversationId]
    );

    await pool.query(
      `UPDATE support_messages
       SET read_at = COALESCE(read_at, NOW())
       WHERE conversation_id = $1 AND sender = 'visitor'`,
      [conversationId]
    );

    const conversation = exists.rows[0];
    res.json({
      conversation: {
        id: Number(conversation.id),
        status: conversation.status,
        createdAt: conversation.created_at,
        lastMessageAt: conversation.last_message_at,
        contact: {
          email: conversation.contact_email || "",
          whatsapp: conversation.contact_whatsapp || "",
        },
      },
      messages: result.rows.map((row) => ({
        id: Number(row.id),
        sender: row.sender,
        body: row.body,
        createdAt: row.created_at,
        readAt: row.read_at,
      })),
    });
  });

  app.post("/api/admin/support/conversations/:id/messages", requireAdmin, async (req, res) => {
    if (!pool) return res.status(503).json({ error: "database_not_configured" });

    try {
      const conversationId = Number(req.params.id);
      if (!Number.isInteger(conversationId) || conversationId <= 0) {
        return res.status(400).json({ error: "invalid_conversation" });
      }

      const body = cleanMessage(req.body?.message);

      const inserted = await pool.query(
        `INSERT INTO support_messages(conversation_id, sender, body)
         SELECT id, 'admin', $2
         FROM support_conversations
         WHERE id = $1
         RETURNING id, sender, body, created_at, read_at`,
        [conversationId, body]
      );

      if (!inserted.rows[0]) {
        return res.status(404).json({ error: "conversation_not_found" });
      }

      await pool.query(
        `UPDATE support_conversations
         SET status = 'open', last_message_at = NOW()
         WHERE id = $1`,
        [conversationId]
      );

      const row = inserted.rows[0];
      res.status(201).json({
        message: {
          id: Number(row.id),
          sender: row.sender,
          body: row.body,
          createdAt: row.created_at,
          readAt: row.read_at,
        },
      });
    } catch (error) {
      res.status(error?.statusCode || 500).json({
        error: "support_reply_failed",
        message: error?.message || "Não foi possível enviar a resposta.",
      });
    }
  });

  app.post("/api/admin/support/conversations/:id/status", requireAdmin, async (req, res) => {
    if (!pool) return res.status(503).json({ error: "database_not_configured" });

    const conversationId = Number(req.params.id);
    const status = String(req.body?.status || "");
    if (!Number.isInteger(conversationId) || conversationId <= 0) {
      return res.status(400).json({ error: "invalid_conversation" });
    }
    if (!["open", "closed"].includes(status)) {
      return res.status(400).json({ error: "invalid_status" });
    }

    const result = await pool.query(
      `UPDATE support_conversations
       SET status = $2
       WHERE id = $1
       RETURNING id`,
      [conversationId, status]
    );

    if (!result.rows[0]) {
      return res.status(404).json({ error: "conversation_not_found" });
    }

    res.json({ ok: true, status });
  });
}
