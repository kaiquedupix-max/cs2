// Admin finance overview and per-client detail. Read-only: nothing here grants, revokes or charges anything.
const PRODUCT_LABELS = {
  cs2: "Counter-Strike 2",
  combatarms: "Combat Arms Brasil Server",
  "counterframe-android": "Counter Flame (Android)",
  "counterframe-ios": "Counter Flame (iOS)",
};
const GROUP_LABELS = {
  cs2: "Counter-Strike 2",
  combatarms: "Combat Arms Brasil Server",
  counterframe: "Counter Flame",
};
const GATEWAY_LABELS = { mercadopago: "Mercado Pago (site)", stripe: "Stripe (site)", telegram: "Telegram (bot)" };

export const productLabel = (code) => PRODUCT_LABELS[code] || code;
const groupOf = (code) => (String(code).startsWith("counterframe") ? "counterframe" : code);
const groupLabel = (g) => GROUP_LABELS[g] || g;

// Month boundaries in Brasilia time (UTC-3, no DST).
export function monthRange(month) {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(String(month || ""));
  const now = new Date(Date.now() - 3 * 3600 * 1000);
  const year = m ? Number(m[1]) : now.getUTCFullYear();
  const mon = m ? Number(m[2]) : now.getUTCMonth() + 1;
  const at = (y, mo) => new Date(Date.UTC(y, mo - 1, 1, 3, 0, 0));
  const nextY = mon === 12 ? year + 1 : year, nextM = mon === 12 ? 1 : mon + 1;
  const prevY = mon === 1 ? year - 1 : year, prevM = mon === 1 ? 12 : mon - 1;
  return {
    month: `${year}-${String(mon).padStart(2, "0")}`,
    start: at(year, mon), end: at(nextY, nextM), prevStart: at(prevY, prevM),
  };
}

const money = () => ({ BRL: 0, USD: 0 });
const addMoney = (acc, currency, amount) => {
  const c = String(currency || "BRL").toUpperCase();
  acc[c] = (acc[c] || 0) + amount;
};
const round = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(v * 100) / 100]));

export function registerAdminStats(app, { pool, requireAdmin }) {
  async function rows(sql, params) {
    try { return (await pool.query(sql, params)).rows; } catch { return []; }
  }

  // Paid sales from both channels (website checkout and Telegram bot) as one normalized list.
  async function loadSales(start, end) {
    const site = await rows(
      `SELECT p.id, p.provider, p.product_code, COALESCE(p.currency,'BRL') AS currency,
              COALESCE(p.amount, p.expected_amount, 0)::float8 AS amount, p.paid_at AS at, u.username
         FROM checkout_payments p JOIN users u ON u.id = p.user_id
        WHERE p.status = 'paid' AND p.paid_at >= $1 AND p.paid_at < $2
        ORDER BY p.paid_at DESC LIMIT 20000`, [start, end]);
    const bot = await rows(
      `SELECT payload AS id, provider, COALESCE(currency,'BRL') AS currency,
              (COALESCE(amount_cents,0)/100.0)::float8 AS amount, COALESCE(stars,0)::int AS stars,
              COALESCE(paid_at, delivered_at) AS at, telegram_id::text AS who
         FROM cf_bot_orders
        WHERE refunded_at IS NULL
          AND ((provider = 'telegram_stars' AND delivered_at >= $1 AND delivered_at < $2)
            OR (provider <> 'telegram_stars' AND status = 'paid' AND paid_at >= $1 AND paid_at < $2))
        ORDER BY COALESCE(paid_at, delivered_at) DESC LIMIT 20000`, [start, end]);
    return [
      ...site.map((r) => ({
        at: r.at, gateway: r.provider === "stripe" ? "stripe" : "mercadopago", via: r.provider,
        product: groupOf(r.product_code), productCode: r.product_code, currency: r.currency,
        amount: Number(r.amount), stars: 0, who: r.username,
      })),
      ...bot.map((r) => ({
        at: r.at, gateway: "telegram", via: r.provider, product: "counterframe", productCode: "counterframe-telegram",
        currency: r.provider === "telegram_stars" ? "STARS" : r.currency, amount: r.provider === "telegram_stars" ? 0 : Number(r.amount),
        stars: Number(r.stars), who: "tg:" + r.who,
      })),
    ];
  }

  const summarize = (sales, keyFn, labelFn) => {
    const map = new Map();
    for (const s of sales) {
      const k = keyFn(s);
      const e = map.get(k) || { key: k, label: labelFn(k), sales: 0, revenue: money(), stars: 0 };
      e.sales += 1;
      if (s.stars) e.stars += s.stars; else addMoney(e.revenue, s.currency, s.amount);
      map.set(k, e);
    }
    return [...map.values()].map((e) => ({ ...e, revenue: round(e.revenue) })).sort((a, b) => b.sales - a.sales);
  };

  app.get("/api/admin/overview", requireAdmin, async (req, res) => {
    if (!pool) return res.status(503).json({ error: "database_not_configured" });
    const range = monthRange(req.query.month);
    const [sales, previous] = await Promise.all([loadSales(range.start, range.end), loadSales(range.prevStart, range.start)]);

    const totals = money();
    let stars = 0;
    for (const s of sales) { if (s.stars) stars += s.stars; else addMoney(totals, s.currency, s.amount); }
    const prevTotals = money();
    for (const s of previous) if (!s.stars) addMoney(prevTotals, s.currency, s.amount);

    const byGateway = summarize(sales, (s) => s.gateway, (k) => GATEWAY_LABELS[k] || k);
    for (const g of byGateway) {
      if (g.key === "telegram") {
        g.via = summarize(sales.filter((s) => s.gateway === "telegram"), (s) => s.via,
          (k) => ({ telegram_stars: "Telegram Stars", mercadopago: "Mercado Pago", stripe: "Stripe" }[k] || k))
          .map(({ key, label, sales: n, revenue, stars: st }) => ({ key, label, sales: n, revenue, stars: st }));
      }
    }
    const byProduct = summarize(sales, (s) => s.product, groupLabel);

    const days = Math.round((range.end - range.start) / 86400000);
    const daily = Array.from({ length: days }, (_, i) => {
      const day = new Date(range.start.getTime() + i * 86400000);
      return { date: new Date(day.getTime() - 3 * 3600 * 1000).toISOString().slice(0, 10), sales: 0, BRL: 0 };
    });
    for (const s of sales) {
      if (!s.at) continue;
      const i = Math.floor((new Date(s.at) - range.start) / 86400000);
      if (daily[i]) { daily[i].sales += 1; if (!s.stars && s.currency === "BRL") daily[i].BRL += s.amount; }
    }

    res.json({
      month: range.month,
      totals: { revenue: round(totals), stars, sales: sales.length, previous: { revenue: round(prevTotals), sales: previous.length } },
      byGateway,
      byProduct,
      top: byProduct[0] ? { product: byProduct[0].key, label: byProduct[0].label, sales: byProduct[0].sales } : null,
      daily: daily.map((d) => ({ ...d, BRL: Math.round(d.BRL * 100) / 100 })),
      recent: sales.slice(0, 12).map((s) => ({
        at: s.at, gateway: GATEWAY_LABELS[s.gateway] || s.gateway, product: groupLabel(s.product),
        amount: s.stars ? `${s.stars} ⭐` : `${s.currency === "USD" ? "US$" : "R$"} ${s.amount.toFixed(2)}`, who: s.who,
      })),
      note: "Somente vendas com status pago. Telegram Stars aparece em estrelas, não em reais.",
    });
  });

  app.get("/api/admin/clients/:id/detail", requireAdmin, async (req, res) => {
    if (!pool) return res.status(503).json({ error: "database_not_configured" });
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ error: "invalid_id" });

    const [user] = await rows(
      `SELECT id, username, email, created_at, disabled_at, (hwid_hash IS NOT NULL) AS hwid_bound FROM users WHERE id = $1`, [id]);
    if (!user) return res.status(404).json({ error: "client_not_found" });

    const products = await rows(
      `SELECT product_code, plan, purchased_at, expires_at, revoked_at FROM user_products WHERE user_id = $1 ORDER BY purchased_at`, [id]);
    const payments = await rows(
      `SELECT id, provider, product_code, plan_name, COALESCE(currency,'BRL') AS currency, COALESCE(amount, expected_amount)::float8 AS amount,
              status, payment_method, created_at, paid_at
         FROM checkout_payments WHERE user_id = $1 ORDER BY created_at DESC LIMIT 100`, [id]);
    const keys = await rows(
      `SELECT k.id, k.plan, k.days, k.activated_at, k.expires_at, k.revoked_at, o.provider AS via
         FROM cf_keys k LEFT JOIN cf_bot_orders o ON o.key_id = k.id
        WHERE k.claimed_by = $1 OR k.buyer_id = $1 ORDER BY k.id DESC LIMIT 50`, [id]);

    const now = Date.now();
    const licenses = products.map((p) => {
      const lifetime = String(p.plan || "").toLowerCase() === "lifetime";
      const exp = p.expires_at ? new Date(p.expires_at).getTime() : 0;
      const status = p.revoked_at ? "revoked" : (lifetime || exp > now ? "active" : "expired");
      const paid = payments.find((x) => x.product_code === p.product_code && x.status === "paid");
      const plan = String(p.plan || "");
      const viaKey = keys.length && String(p.product_code).startsWith("counterframe");
      const origin = paid ? (GATEWAY_LABELS[paid.provider === "stripe" ? "stripe" : "mercadopago"])
        : plan === "admin" ? "Liberado pelo admin"
        : plan === "free" ? "Teste grátis"
        : viaKey ? "Key (Telegram/site)" : "Não identificado";
      return {
        product: p.product_code, label: productLabel(p.product_code), plan: plan === "free" ? "Teste grátis" : plan,
        status, purchasedAt: p.purchased_at, expiresAt: lifetime ? null : p.expires_at, lifetime,
        daysRemaining: status === "active" && !lifetime ? Math.max(1, Math.ceil((exp - now) / 86400000)) : 0, origin,
      };
    });

    res.json({
      client: {
        id: Number(user.id), username: user.username, email: user.email, createdAt: user.created_at,
        banned: Boolean(user.disabled_at), hwidBound: Boolean(user.hwid_bound),
      },
      licenses,
      payments: payments.map((p) => ({
        id: Number(p.id), gateway: GATEWAY_LABELS[p.provider === "stripe" ? "stripe" : "mercadopago"], product: productLabel(p.product_code),
        plan: p.plan_name, amount: p.amount, currency: p.currency, status: p.status, method: p.payment_method, createdAt: p.created_at, paidAt: p.paid_at,
      })),
      keys: keys.map((k) => ({
        id: Number(k.id), plan: k.plan, days: k.days, activatedAt: k.activated_at, expiresAt: k.expires_at, revoked: Boolean(k.revoked_at),
        via: k.via ? (k.via === "telegram_stars" ? "Telegram Stars" : "Telegram (" + k.via + ")") : "Site",
      })),
    });
  });
}
