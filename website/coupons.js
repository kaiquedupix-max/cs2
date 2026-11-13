export function discount(priceCents, percent) {
  if (!Number.isSafeInteger(priceCents) || priceCents < 1 ||
      !Number.isInteger(percent) || percent < 0 || percent > 90) {
    throw Error("invalid_discount");
  }
  return Math.max(1, Math.round(priceCents * (100 - percent) / 100));
}

function normalizedCode(value) {
  return String(value || "").trim().toUpperCase();
}

function invalidCoupon() {
  return Object.assign(Error("invalid_coupon"), { status: 400, statusCode: 400 });
}

export async function couponDiscount(pool, value, product) {
  if (!value) return { code: "", percent: 0 };
  const code = normalizedCode(value);
  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) throw invalidCoupon();

  const { rows } = await pool.query(
    `SELECT code, percent
       FROM sale_coupons
      WHERE code = $1
        AND enabled = TRUE
        AND (product = 'all' OR product = $2)
        AND (max_uses IS NULL OR used_count < max_uses)`,
    [code, product]
  );
  if (!rows[0]) throw invalidCoupon();
  return rows[0];
}

// Reserve one redemption when the payment is created. The stable redemption
// key makes retries of the same checkout idempotent and keeps the usage cap atomic.
export async function reserveCoupon(pool, value, product, redemptionKey) {
  if (!value) return;
  const code = normalizedCode(value);
  const key = String(redemptionKey || "").trim();
  if (!/^[A-Z0-9_-]{3,32}$/.test(code) || !key) throw invalidCoupon();

  const db = await pool.connect();
  try {
    await db.query("BEGIN");
    const existing = await db.query(
      "SELECT code FROM sale_coupon_uses WHERE redemption_key = $1 FOR UPDATE",
      [key]
    );
    if (existing.rows[0]) {
      if (existing.rows[0].code !== code) throw invalidCoupon();
      await db.query("COMMIT");
      return;
    }

    const updated = await db.query(
      `UPDATE sale_coupons
          SET used_count = used_count + 1
        WHERE code = $1
          AND enabled = TRUE
          AND (product = 'all' OR product = $2)
          AND (max_uses IS NULL OR used_count < max_uses)
        RETURNING code`,
      [code, product]
    );
    if (!updated.rows[0]) throw invalidCoupon();

    await db.query(
      "INSERT INTO sale_coupon_uses(redemption_key, code) VALUES($1, $2)",
      [key, code]
    );
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
}

export async function initCoupons(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sale_coupons(
      code TEXT PRIMARY KEY,
      percent INTEGER NOT NULL CHECK(percent BETWEEN 1 AND 90),
      product TEXT NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      expires_at TIMESTAMPTZ,
      max_uses INTEGER CHECK(max_uses IS NULL OR max_uses > 0),
      used_count INTEGER NOT NULL DEFAULT 0 CHECK(used_count >= 0),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE sale_coupons ADD COLUMN IF NOT EXISTS max_uses INTEGER;
    ALTER TABLE sale_coupons ADD COLUMN IF NOT EXISTS used_count INTEGER NOT NULL DEFAULT 0;
    CREATE TABLE IF NOT EXISTS sale_coupon_uses(
      redemption_key TEXT PRIMARY KEY,
      code TEXT NOT NULL REFERENCES sale_coupons(code),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    ALTER TABLE checkout_payments ADD COLUMN IF NOT EXISTS coupon_code TEXT;
    ALTER TABLE cf_bot_users ADD COLUMN IF NOT EXISTS coupon_code TEXT;
    ALTER TABLE cf_bot_orders ADD COLUMN IF NOT EXISTS coupon_code TEXT;

    INSERT INTO sale_coupon_uses(redemption_key, code)
      SELECT 'checkout:' || id::text, coupon_code
        FROM checkout_payments
       WHERE coupon_code IS NOT NULL AND status = 'paid'
      ON CONFLICT(redemption_key) DO NOTHING;
    INSERT INTO sale_coupon_uses(redemption_key, code)
      SELECT 'telegram:' || payload, coupon_code
        FROM cf_bot_orders
       WHERE coupon_code IS NOT NULL AND charge_id IS NOT NULL
      ON CONFLICT(redemption_key) DO NOTHING;
    UPDATE sale_coupons c
       SET used_count = GREATEST(c.used_count, (
         SELECT COUNT(*)::integer FROM sale_coupon_uses u WHERE u.code = c.code
       ));
  `);
}

export function registerCoupons(app, { pool, requireAdmin }) {
  app.get("/api/admin/coupons", requireAdmin, async (_req, res) => {
    try {
      const { rows } = await pool.query(
        "SELECT code, percent, product, enabled, max_uses, used_count, created_at FROM sale_coupons ORDER BY created_at DESC LIMIT 200"
      );
      res.json({ coupons: rows });
    } catch {
      res.status(500).json({ error: "server_error" });
    }
  });

  app.post("/api/admin/coupons", requireAdmin, async (req, res) => {
    try {
      const { percent, product, enabled } = req.body || {};
      const code = normalizedCode(req.body?.code);
      const rawMaxUses = req.body?.maxUses;
      const maxUses = rawMaxUses == null || rawMaxUses === "" ? null : Number(rawMaxUses);
      if (!/^[A-Z0-9_-]{3,32}$/.test(code) ||
          !Number.isInteger(percent) || percent < 1 || percent > 90 ||
          !["all", "cs2", "combatarms", "counterframe"].includes(product) ||
          typeof enabled !== "boolean" ||
          (maxUses !== null && (!Number.isSafeInteger(maxUses) || maxUses < 1 || maxUses > 1000000000))) {
        return res.status(400).json({ error: "invalid_coupon" });
      }

      await pool.query(
        `INSERT INTO sale_coupons(code, percent, product, enabled, max_uses)
         VALUES($1, $2, $3, $4, $5)
         ON CONFLICT(code) DO UPDATE SET
           percent = EXCLUDED.percent,
           product = EXCLUDED.product,
           enabled = EXCLUDED.enabled,
           max_uses = EXCLUDED.max_uses`,
        [code, percent, product, enabled, maxUses]
      );
      res.json({ ok: true });
    } catch {
      res.status(500).json({ error: "server_error" });
    }
  });
}
