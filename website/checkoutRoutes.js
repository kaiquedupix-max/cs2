import {
  checkoutConfig,
  checkoutPlan,
  createPayment,
  getPayment,
  paymentView,
  validCpf,
  verifyWebhook,
  normalizeProduct,
  normalizeMarket,
} from "./mercadoPago.js";

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 160;
}

function cleanBuyer(body, product) {
  const buyer = {
    fullName: String(body?.fullName || "").trim().slice(0, 160),
    cpf: String(body?.cpf || "").trim().slice(0, 32),
    email: String(body?.email || "").trim().toLowerCase().slice(0, 160),
    fingerprint: String(body?.fingerprint || "").trim().slice(0, 200),
  };

  if (buyer.fullName.length < 3 || !buyer.fullName.includes(" ")) {
    throw Object.assign(new Error("Informe o nome completo."), { statusCode: 400 });
  }

  if ((product === "cs2" || buyer.cpf) && !validCpf(buyer.cpf)) {
    throw Object.assign(new Error("Informe um CPF válido ou deixe o documento vazio para compra internacional de Counter-Frame."), { statusCode: 400 });
  }

  if (!validEmail(buyer.email)) {
    throw Object.assign(new Error("Informe um e-mail válido."), { statusCode: 400 });
  }

  if (buyer.fingerprint.length < 8) {
    throw Object.assign(new Error("Identificação do navegador ausente."), { statusCode: 400 });
  }

  return buyer;
}

function validIntent(value) {
  return /^[a-zA-Z0-9._:-]{16,255}$/.test(String(value || ""));
}

export function registerCheckoutRoutes(app, deps) {
  const {
    pool,
    requireUser,
    optionalUser,
    accountSnapshot,
    productCode,
  } = deps;

  async function saveProfile(userId, buyer) {
    await pool.query(
      `INSERT INTO customer_profiles(
         user_id, full_name, cpf, email, phone, process_number,
         billing_street, billing_number, billing_complement,
         billing_city, billing_state, billing_zipcode, updated_at
       )
       VALUES ($1,$2,$3,$4,'','', '', '', '', '', '', '', NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET
         full_name = EXCLUDED.full_name,
         cpf = EXCLUDED.cpf,
         email = EXCLUDED.email,
         updated_at = NOW()`,
      [userId, buyer.fullName, buyer.cpf, buyer.email]
    );
  }

  async function createIntent({ userId, idempotencyKey, method, buyer, plan, productCode, platform, installments = 1, card = null }) {
    await saveProfile(userId, buyer);

    const result = await pool.query(
      `INSERT INTO checkout_payments(
         user_id, provider, idempotency_key, payment_method, status, installments,
         buyer_name, buyer_cpf, buyer_email, buyer_phone, process_number,
         card_holder_name, card_last4, card_expiry,
         plan_key, plan_name, plan_days, plan_lifetime, expected_amount,
         product_code, product_platform
       )
       VALUES ($1,'mercadopago',$2,$3,'creating',$4,$5,$6,$7,'','',$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)
       ON CONFLICT (idempotency_key)
       DO UPDATE SET updated_at = NOW()
       RETURNING id, product_code, product_platform, plan_key, expected_amount`,
      [
        userId,
        idempotencyKey,
        method,
        installments,
        buyer.fullName,
        buyer.cpf,
        buyer.email,
        card?.holderName || null,
        card?.last4 || null,
        card?.expiry || null,
        plan.key,
        plan.name,
        plan.days,
        Boolean(plan.lifetime),
        Number(plan.priceCents || 0) / 100,
        productCode,
        platform,
      ]
    );

    const created = result.rows[0];
    if (created.product_code !== productCode ||
        created.product_platform !== platform ||
        created.plan_key !== plan.key ||
        Number(created.expected_amount) !== Number((plan.priceCents / 100).toFixed(2))) {
      throw Object.assign(new Error("Chave de pagamento já utilizada para outro produto."), { statusCode: 409 });
    }
    return Number(created.id);
  }

  async function updateFromProvider(localId, payment, extra = {}) {
    await pool.query(
      `UPDATE checkout_payments
       SET provider_order_id = COALESCE($2, provider_order_id),
           provider_ref_id = COALESCE($3, provider_ref_id),
           provider_external_id = COALESCE($4, provider_external_id),
           status = COALESCE($5, status),
           amount = COALESCE($6::numeric, amount),
           pix_copy_paste = COALESCE($7, pix_copy_paste),
           pix_expires_at = COALESCE($8::timestamptz, pix_expires_at),
           card_brand = COALESCE($9, card_brand),
           card_last4 = COALESCE($10, card_last4),
           updated_at = NOW()
       WHERE id = $1`,
      [
        localId,
        payment?.id || null,
        payment?.refId || null,
        payment?.externalId || null,
        payment?.status || null,
        payment?.amount ?? null,
        payment?.pix?.qrCode || null,
        payment?.pix?.expirationDate || null,
        extra.cardBrand || null,
        extra.cardLast4 || null,
      ]
    );
  }

  async function activate(localId, paidAt = null) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(
        `SELECT user_id, access_granted_at, plan_key, plan_name, plan_days, plan_lifetime,
                product_code, product_platform
         FROM checkout_payments
         WHERE id = $1
         FOR UPDATE`,
        [localId]
      );

      const payment = result.rows[0];
      if (!payment) {
        await client.query("ROLLBACK");
        return false;
      }

      // iOS is an explicit pre-order. The payment is recorded, but access is not
      // granted until the iOS app is actually released.
      if (payment.product_code === "counterframe-ios") {
        await client.query(
          `UPDATE checkout_payments
           SET status='paid', paid_at=COALESCE($2::timestamptz,paid_at,NOW()),updated_at=NOW()
           WHERE id=$1`,
          [localId,paidAt]
        );
        await client.query("COMMIT");
        return true;
      }

      if (!payment.access_granted_at) {
        const fallback = checkoutPlan("d30", payment.product_code === "cs2" ? "cs2" : "counterframe");
        const planName = String(payment.plan_name || fallback?.name || "1 mês");
        const planDays = Math.max(1, Number(payment.plan_days || fallback?.days || 30));
        const lifetime = Boolean(payment.plan_lifetime) || planName.toLowerCase() === "lifetime";

        await client.query(
          `INSERT INTO user_products(user_id, product_code, plan, purchased_at, expires_at, revoked_at)
           VALUES (
             $1,$2,$3,NOW(),
             CASE WHEN $5::boolean THEN TIMESTAMPTZ '9999-12-31 23:59:59+00'
                  ELSE NOW() + ($4 || ' days')::interval END,
             NULL
           )
           ON CONFLICT (user_id, product_code)
           DO UPDATE SET
             plan = CASE
               WHEN user_products.expires_at >= TIMESTAMPTZ '9999-01-01 00:00:00+00' THEN user_products.plan
               ELSE EXCLUDED.plan
             END,
             purchased_at = NOW(),
             expires_at = CASE
               WHEN user_products.expires_at >= TIMESTAMPTZ '9999-01-01 00:00:00+00'
                 THEN user_products.expires_at
               WHEN $5::boolean
                 THEN TIMESTAMPTZ '9999-12-31 23:59:59+00'
               ELSE GREATEST(user_products.expires_at, NOW()) + ($4 || ' days')::interval
             END,
             revoked_at = NULL`,
          [Number(payment.user_id), String(payment.product_code || productCode), planName, String(planDays), lifetime]
        );
      }

      await client.query(
        `UPDATE checkout_payments
         SET status = 'paid',
             paid_at = COALESCE($2::timestamptz, paid_at, NOW()),
             access_granted_at = COALESCE(access_granted_at, NOW()),
             updated_at = NOW()
         WHERE id = $1`,
        [localId, paidAt]
      );

      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async function reverse(localId, status, eventAt = null) {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const result = await client.query(
        `SELECT user_id, access_granted_at, product_code
         FROM checkout_payments
         WHERE id = $1
         FOR UPDATE`,
        [localId]
      );

      const payment = result.rows[0];
      if (!payment) {
        await client.query("ROLLBACK");
        return;
      }

      await client.query(
        `UPDATE checkout_payments
         SET status = $2,
             reversed_at = COALESCE($3::timestamptz, NOW()),
             updated_at = NOW()
         WHERE id = $1`,
        [localId, status, eventAt]
      );

      if (payment.access_granted_at) {
        await client.query(
          `UPDATE user_products
           SET revoked_at = NOW()
           WHERE user_id = $1
             AND product_code = $2
             AND revoked_at IS NULL`,
          [Number(payment.user_id), String(payment.product_code || productCode)]
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  async function syncMercadoPago(localId, rawPayment) {
    const view = paymentView(rawPayment);

    await updateFromProvider(localId, {
      id: view.id,
      refId: view.refId,
      externalId: view.externalId,
      status: view.status,
      amount: view.amount,
      pix: {
        qrCode: view.pix.qrCode,
        expirationDate: view.pix.expirationDate,
      },
    }, {
      cardBrand: view.cardBrand,
      cardLast4: view.cardLast4,
    });

    if (view.status === "paid") {
      await activate(localId, view.paidAt || null);
    } else if (["refund", "chargeback", "canceled"].includes(view.status)) {
      await reverse(localId, view.status, null);
    }

    return view;
  }

  app.get("/api/checkout/config", optionalUser, async (req, res) => {
    const product = normalizeProduct(req.query.product);
    const market = product === "counterframe" ? normalizeMarket(req.query.market) : "BR";
    const config = checkoutConfig(product,market);

    let row = {};
    if (req.userId && pool) {
      const result = await pool.query(
        `SELECT
           cp.full_name,
           cp.cpf,
           cp.email,
           u.email AS account_email,
           u.username AS account_username
         FROM users u
         LEFT JOIN customer_profiles cp ON cp.user_id = u.id
         WHERE u.id = $1
         LIMIT 1`,
        [req.userId]
      );
      row = result.rows[0] || {};
    }

    res.json({
      configured: config.configured,
      product,
      market: config.market,
      settlementCurrency: config.settlementCurrency,
      publicKey: config.publicKey,
      authenticated: Boolean(req.userId),
      account: req.userId ? {
        id: Number(req.userId),
        username: row.account_username || "",
        email: row.account_email || "",
      } : null,
      plans: config.plans.map(({ key, name, days, lifetime, priceCents, usdPriceCents, available }) => ({
        key,
        name,
        days,
        lifetime: Boolean(lifetime),
        priceCents,
        usdPriceCents: usdPriceCents ?? null,
        available,
      })),
      profile: {
        fullName: row.full_name || "",
        cpf: row.cpf || "",
        email: row.email || row.account_email || "",
      },
    });
  });

  app.post("/api/checkout/payment", requireUser, async (req, res) => {
    const requested = String(req.body?.product || "cs2").toLowerCase();
    if (!["cs2", "counterframe", "cf"].includes(requested)) {
      return res.status(400).json({ error: "unknown_product" });
    }
    const product = normalizeProduct(requested);
    const platform = product === "counterframe" ? String(req.body?.platform || "") : "windows";
    if (product === "counterframe" && !["android", "ios"].includes(platform)) {
      return res.status(400).json({ error: "invalid_platform" });
    }
    const orderedProductCode = product === "counterframe" ? "counterframe-" + platform : productCode;
    const market = product === "counterframe" ? normalizeMarket(req.body?.market) : "BR";
    const config = checkoutConfig(product,market);
    const plan = checkoutPlan(req.body?.planKey, product,market);

    if (!config.configured || !plan) {
      return res.status(503).json({
        error: "checkout_not_configured",
        message: "Mercado Pago ainda não configurado.",
      });
    }

    const idempotencyKey = String(req.body?.idempotencyKey || "").trim();
    if (!validIntent(idempotencyKey)) {
      return res.status(400).json({
        error: "invalid_intent",
        message: "Intenção de pagamento inválida.",
      });
    }

    try {
      const buyer = cleanBuyer(req.body, product);
      const formData = req.body?.formData && typeof req.body.formData === "object"
        ? req.body.formData
        : {};
      const method = String(formData.payment_method_id || "unknown").slice(0, 60);

      const localId = await createIntent({
        userId: req.userId,
        idempotencyKey,
        method,
        buyer,
        plan,
        productCode: orderedProductCode,
        platform,
        installments: Math.max(1, Math.min(12, Math.trunc(Number(formData.installments || 1)))),
      });

      const rawPayment = await createPayment({
        userId: req.userId,
        localId,
        plan,
        buyer,
        formData,
        idempotencyKey,
        deviceId: req.body?.device_id || req.body?.deviceId,
        product,
        platform,
        market,
      });

      const view = await syncMercadoPago(localId, rawPayment);

      return res.status(201).json({
        paymentId: localId,
        product, platform, market,
        settlementCurrency: "BRL",
        preOrder: platform === "ios",
        status: view.status,
        rawStatus: view.rawStatus,
        statusDetail: view.statusDetail,
        amount: view.amount,
        refId: view.refId,
        pix: view.pix.qrCode ? {
          copyPaste: view.pix.qrCode,
          qrCodeBase64: view.pix.qrCodeBase64,
          ticketUrl: view.pix.ticketUrl,
          expiresAt: view.pix.expirationDate,
        } : null,
        account: view.status === "paid" ? await accountSnapshot(req.userId) : null,
      });
    } catch (error) {
      console.error("Falha ao criar pagamento Mercado Pago:", error?.message || error);
      return res.status(error?.statusCode || 500).json({
        error: "payment_failed",
        message: error?.message || "Não foi possível processar o pagamento.",
      });
    }
  });

  app.get("/api/checkout/payments/:id", requireUser, async (req, res) => {
    const paymentId = Number(req.params.id);

    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      return res.status(400).json({ error: "invalid_payment" });
    }

    let result = await pool.query(
      `SELECT
         id, payment_method, status, amount, provider_order_id, provider_ref_id,
         pix_expires_at, paid_at, card_brand, card_last4,
         plan_key, plan_name, plan_days, plan_lifetime, product_code, product_platform
       FROM checkout_payments
       WHERE id = $1 AND user_id = $2
       LIMIT 1`,
      [paymentId, req.userId]
    );

    let payment = result.rows[0];
    if (!payment) {
      return res.status(404).json({ error: "payment_not_found" });
    }

    if (payment.provider_order_id && payment.status !== "paid") {
      try {
        const rawPayment = await getPayment(payment.provider_order_id);
        await syncMercadoPago(paymentId, rawPayment);

        result = await pool.query(
          `SELECT
             id, payment_method, status, amount, provider_order_id, provider_ref_id,
             pix_expires_at, paid_at, card_brand, card_last4,
             plan_key, plan_name, plan_days, plan_lifetime, product_code, product_platform
           FROM checkout_payments
           WHERE id = $1 AND user_id = $2
           LIMIT 1`,
          [paymentId, req.userId]
        );
        payment = result.rows[0];
      } catch (error) {
        console.error("Falha ao consultar pagamento Mercado Pago:", error?.message || error);
      }
    }

    return res.json({
      payment: {
        id: Number(payment.id),
        method: payment.payment_method,
        status: payment.status,
        amount: payment.amount,
        refId: payment.provider_ref_id,
        pixExpiresAt: payment.pix_expires_at,
        paidAt: payment.paid_at,
        product: payment.product_code,
        platform: payment.product_platform,
        preOrder: payment.product_code === "counterframe-ios",
        cardBrand: payment.card_brand,
        cardLast4: payment.card_last4,
        plan: {
          key: payment.plan_key,
          name: payment.plan_name,
          days: payment.plan_days,
          lifetime: Boolean(payment.plan_lifetime),
        },
      },
      account: payment.status === "paid" ? await accountSnapshot(req.userId) : null,
    });
  });

  app.post("/api/webhooks/mercadopago", async (req, res) => {
    if (!pool) return res.status(503).send("database_unavailable");

    const dataId = String(
      req.body?.data?.id ||
      req.query?.["data.id"] ||
      req.query?.id ||
      ""
    ).trim();

    if (!dataId) return res.sendStatus(200);

    if (!verifyWebhook(req.headers, dataId)) {
      return res.status(401).send("unauthorized");
    }

    try {
      const rawPayment = await getPayment(dataId);
      const metadata = rawPayment?.metadata || {};
      let localId = Number(metadata.local_payment_id || 0);

      if (!localId) {
        const localResult = await pool.query(
          "SELECT id FROM checkout_payments WHERE provider_order_id = $1 LIMIT 1",
          [String(rawPayment?.id || dataId)]
        );
        localId = Number(localResult.rows[0]?.id || 0);
      }

      if (!localId) return res.sendStatus(200);

      await syncMercadoPago(localId, rawPayment);
      return res.sendStatus(200);
    } catch (error) {
      console.error("Falha ao processar webhook Mercado Pago:", error?.message || error);
      return res.sendStatus(500);
    }
  });
}
