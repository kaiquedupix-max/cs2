import { recomputeCounterframe } from "./referrals.js";

export function registerTelegramAdmin(app, { pool, requireAdmin }) {
  if (!pool || !requireAdmin) return;

  app.get("/api/admin/telegram", requireAdmin, async (_req, res) => {
    try {
      const [users, orders, keys, rewards, events, summary] = await Promise.all([
        pool.query(`SELECT b.telegram_id::text AS telegram_id, b.username, b.first_name,
          b.language, b.first_started_at, b.last_started_at, b.last_seen_at, b.start_count,
          b.referrer_telegram_id::text AS referrer_telegram_id,
          u.username AS loader_username,
          (SELECT COUNT(*)::int FROM cf_bot_events e WHERE e.telegram_id = b.telegram_id) AS action_count
          FROM cf_bot_users b LEFT JOIN users u ON u.id = b.linked_user_id
          ORDER BY COALESCE(b.last_seen_at, b.first_started_at) DESC NULLS LAST LIMIT 1000`),
        pool.query(`SELECT o.payload, o.telegram_id::text AS telegram_id, o.days, o.stars,
          o.coupon_code, o.charge_id, o.created_at, o.refunded_at, o.key_id,
          bu.username AS bot_username, u.username AS loader_username,
          ref.username AS referrer_username
          FROM cf_bot_orders o
          LEFT JOIN cf_bot_users bu ON bu.telegram_id = o.telegram_id
          LEFT JOIN cf_keys k ON k.id = o.key_id
          LEFT JOIN users u ON u.id = k.claimed_by
          LEFT JOIN cf_bot_users ref ON ref.telegram_id = o.referrer_telegram_id
          ORDER BY o.created_at DESC LIMIT 1000`),
        pool.query(`SELECT k.id, k.telegram_id::text AS telegram_id, b.username AS bot_username,
          k.plan, k.days, k.duration_seconds, k.claimed_by, u.username AS loader_username,
          k.activated_at, k.expires_at, k.revoked_at, k.lifetime
          FROM cf_keys k LEFT JOIN cf_bot_users b ON b.telegram_id = k.telegram_id
          LEFT JOIN users u ON u.id = k.claimed_by
          WHERE k.telegram_id IS NOT NULL ORDER BY k.id DESC LIMIT 1000`),
        pool.query(`SELECT r.order_payload, r.referrer_telegram_id::text AS referrer_telegram_id,
          rb.username AS referrer_username, r.buyer_telegram_id::text AS buyer_telegram_id,
          bb.username AS buyer_username, r.reward_seconds, r.created_at, r.key_id
          FROM cf_bot_referral_rewards r
          LEFT JOIN cf_bot_users rb ON rb.telegram_id = r.referrer_telegram_id
          LEFT JOIN cf_bot_users bb ON bb.telegram_id = r.buyer_telegram_id
          ORDER BY r.created_at DESC LIMIT 1000`),
        pool.query(`SELECT id, telegram_id::text AS telegram_id, username, event, command,
          details, created_at FROM cf_bot_events ORDER BY id DESC LIMIT 1000`),
        pool.query(`SELECT
          (SELECT COUNT(*)::int FROM cf_bot_users) AS users,
          (SELECT COALESCE(SUM(start_count), 0)::int FROM cf_bot_users) AS starts,
          (SELECT COUNT(*)::int FROM cf_bot_orders WHERE charge_id IS NOT NULL AND refunded_at IS NULL) AS sales,
          (SELECT COUNT(*)::int FROM cf_bot_referral_rewards) AS referrals,
          (SELECT COALESCE(SUM(stars), 0)::bigint FROM cf_bot_orders WHERE charge_id IS NOT NULL AND refunded_at IS NULL) AS stars`)
      ]);
      res.json({
        users: users.rows, orders: orders.rows, keys: keys.rows,
        rewards: rewards.rows, events: events.rows, summary: summary.rows[0]
      });
    } catch (error) {
      console.error("Falha ao carregar painel Telegram:", error?.message || error);
      res.status(500).json({ error: "telegram_admin_unavailable" });
    }
  });

  app.post("/api/admin/telegram/keys/:id/reset", requireAdmin, async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: "invalid_key" });
    const db = await pool.connect();
    try {
      await db.query("BEGIN");
      const result = await db.query(
        `SELECT k.id, k.telegram_id, k.claimed_by
           FROM cf_keys k
           JOIN cf_bot_orders o ON o.key_id = k.id
          WHERE k.id = $1 AND k.telegram_id IS NOT NULL AND k.revoked_at IS NULL
          FOR UPDATE OF k, o`,
        [id]
      );
      const key = result.rows[0];
      if (!key) {
        await db.query("ROLLBACK");
        return res.status(404).json({ error: "key_not_found" });
      }

      if (key.claimed_by) {
        await db.query("SELECT id FROM users WHERE id = $1 FOR UPDATE", [key.claimed_by]);
        await db.query(
          "UPDATE cf_keys SET claimed_by = NULL, activated_at = NULL, expires_at = NULL WHERE id = $1",
          [id]
        );
        await recomputeCounterframe(db, key.claimed_by);
      }
      await db.query(
        `INSERT INTO cf_bot_events(telegram_id, username, event, command, details)
         VALUES($1, (SELECT username FROM cf_bot_users WHERE telegram_id = $1),
           'admin_key_reset', '/adminreset', jsonb_build_object('keyId', $2, 'previousUserId', $3::bigint))`,
        [key.telegram_id, id, key.claimed_by]
      );
      await db.query("COMMIT");
      res.json({ ok: true });
    } catch (error) {
      await db.query("ROLLBACK");
      console.error("Falha ao resetar key do Telegram:", error?.message || error);
      res.status(500).json({ error: "key_reset_failed" });
    } finally {
      db.release();
    }
  });
}
