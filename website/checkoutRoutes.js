import QRCode from "qrcode";
import {
  checkoutConfig,
  checkoutPlan,
  createPayment,
  digitsOnly,
  normalizePhone,
  validCpf,
  verifyWebhook,
} from "./cakto.js";

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 160;
}

function cleanBuyer(body) {
  const buyer = {
    fullName: String(body?.fullName || "").slice(0, 160),
    cpf: String(body?.cpf || "").slice(0, 32),
    email: String(body?.email || "").slice(0, 160),
    phone: String(body?.phone || "").slice(0, 40),
    processNumber: String(body?.processNumber || "").slice(0, 120),
    fingerprint: String(body?.fingerprint || "").trim().slice(0, 200),
    address: {
      street: String(body?.address?.street || "").slice(0, 160),
      number: String(body?.address?.number || "").slice(0, 30),
      complement: String(body?.address?.complement || "").slice(0, 80),
      city: String(body?.address?.city || "").slice(0, 100),
      state: String(body?.address?.state || "").trim().toUpperCase().slice(0, 2),
      zipcode: String(body?.address?.zipcode || "").slice(0, 16),
    },
  };

  if (buyer.fullName.trim().length < 3) {
    throw Object.assign(new Error("Informe o nome completo."), { statusCode: 400 });
  }

  if (!validCpf(buyer.cpf)) {
    throw Object.assign(new Error("Informe um CPF válido."), { statusCode: 400 });
  }

  if (!validEmail(buyer.email.trim().toLowerCase())) {
    throw Object.assign(new Error("Informe um e-mail válido."), { statusCode: 400 });
  }

  const phone = normalizePhone(buyer.phone);
  if (phone.length < 12 || phone.length > 14) {
    throw Object.assign(new Error("Informe um telefone válido com DDD."), { statusCode: 400 });
  }

  if (buyer.processNumber.trim().length < 3) {
    throw Object.assign(new Error("Informe o número do processo."), { statusCode: 400 });
  }

  if (buyer.fingerprint.length < 8) {
    throw Object.assign(new Error("Identificação do navegador ausente."), { statusCode: 400 });
  }

  if (
    buyer.address.street.trim().length < 2 ||
    buyer.address.number.trim().length < 1 ||
    buyer.address.city.trim().length < 2 ||
    !/^[A-Z]{2}$/.test(buyer.address.state) ||
    digitsOnly(buyer.address.zipcode).length !== 8
  ) {
    throw Object.assign(new Error("Preencha corretamente o endereço de cobrança."), { statusCode: 400 });
  }

  buyer.providerCustomer = {
    name: buyer.fullName.trim(),
    email: buyer.email.trim().toLowerCase(),
    phone,
    fingerprint: buyer.fingerprint,
    docType: "cpf",
    docNumber: digitsOnly(buyer.cpf),
  };

  buyer.providerAddress = {
    country: "BR",
    state: buyer.address.state,
    city: buyer.address.city.trim(),
    zipcode: digitsOnly(buyer.address.zipcode),
    street: buyer.address.street.trim(),
    number: buyer.address.number.trim(),
    complement: buyer.address.complement.trim(),
  };

  return buyer;
}

function validIntent(value) {
  return /^[a-zA-Z0-9._:-]{16,255}$/.test(String(value || ""));
}

export function registerCheckoutRoutes(app, deps) {
  const {
    pool,
    requireUser,
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
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,NOW())
       ON CONFLICT (user_id)
       DO UPDATE SET
         full_name = EXCLUDED.full_name,
         cpf = EXCLUDED.cpf,
         email = EXCLUDED.email,
         phone = EXCLUDED.phone,
         process_number = EXCLUDED.process_number,
         billing_street = EXCLUDED.billing_street,
         billing_number = EXCLUDED.billing_number,
         billing_complement = EXCLUDED.billing_complement,
         billing_city = EXCLUDED.billing_city,
         billing_state = EXCLUDED.billing_state,
         billing_zipcode = EXCLUDED.billing_zipcode,
         updated_at = NOW()`,
      [
        userId,
        buyer.fullName,
        buyer.cpf,
        buyer.email,
        buyer.phone,
        buyer.processNumber,
        buyer.address.street,
        buyer.address.number,
        buyer.address.complement,
        buyer.address.city,
        buyer.address.state,
        buyer.address.zipcode,
      ]
    );
  }

  async function createIntent({ userId, idempotencyKey, method, buyer, plan, installments = 1, card = null }) {
    await saveProfile(userId, buyer);

    const result = await pool.query(
      `INSERT INTO checkout_payments(
         user_id, provider, idempotency_key, payment_method, status, installments,
         buyer_name, buyer_cpf, buyer_email, buyer_phone, process_number,
         card_holder_name, card_last4, card_expiry,
         plan_key, plan_name, plan_days, plan_lifetime, offer_id, expected_amount
       )
       VALUES ($1,'cakto',$2,$3,'creating',$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
       ON CONFLICT (idempotency_key)
       DO UPDATE SET updated_at = NOW()
       RETURNING id`,
      [
        userId,
        idempotencyKey,
        method,
        installments,
        buyer.fullName,
        buyer.cpf,
        buyer.email,
        buyer.phone,
        buyer.processNumber,
        card?.holderName || null,
        card?.last4 || null,
        card?.expiry || null,
        plan.key,
        plan.name,
        plan.days,
        Boolean(plan.lifetime),
        plan.offerId,
        Number(plan.priceCents || 0) / 100,
      ]
    );

    return Number(result.rows[0].id);
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
        `SELECT user_id, access_granted_at, plan_key, plan_name, plan_days, plan_lifetime
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

      if (!payment.access_granted_at) {
        const fallback = checkoutPlan("d30");
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
          [Number(payment.user_id), productCode, planName, String(planDays), lifetime]
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
        `SELECT user_id, access_granted_at
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
          [Number(payment.user_id), productCode]
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

  app.get("/api/checkout/config", requireUser, async (req, res) => {
    const config = checkoutConfig();

    const result = await pool.query(
      `SELECT
         cp.full_name,
         cp.cpf,
         cp.email,
         cp.phone,
         cp.process_number,
         cp.billing_street,
         cp.billing_number,
         cp.billing_complement,
         cp.billing_city,
         cp.billing_state,
         cp.billing_zipcode,
         u.email AS account_email
       FROM users u
       LEFT JOIN customer_profiles cp ON cp.user_id = u.id
       WHERE u.id = $1
       LIMIT 1`,
      [req.userId]
    );

    const row = result.rows[0] || {};

    res.json({
      configured: config.configured,
      sdkClientId: config.sdkClientId,
      plans: config.plans.map(({ key, name, days, lifetime, priceCents, available }) => ({
        key,
        name,
        days,
        lifetime: Boolean(lifetime),
        priceCents,
        available,
      })),
      profile: {
        fullName: row.full_name || "",
        cpf: row.cpf || "",
        email: row.email || row.account_email || "",
        phone: row.phone || "",
        processNumber: row.process_number || "",
        address: {
          street: row.billing_street || "",
          number: row.billing_number || "",
          complement: row.billing_complement || "",
          city: row.billing_city || "",
          state: row.billing_state || "",
          zipcode: row.billing_zipcode || "",
        },
      },
    });
  });

  app.post("/api/checkout/pix", requireUser, async (req, res) => {
    const config = checkoutConfig();
    const plan = checkoutPlan(req.body?.planKey);

    if (!config.configured || !plan?.available) {
      return res.status(503).json({
        error: "checkout_not_configured",
        message: "Checkout ainda não configurado.",
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
      const buyer = cleanBuyer(req.body);
      const localId = await createIntent({
        userId: req.userId,
        idempotencyKey,
        method: "pix",
        buyer,
        plan,
      });

      const payment = await createPayment(
        {
          paymentMethod: "pix",
          customer: {
            ...buyer.providerCustomer,
            ip: String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "")
              .split(",")[0]
              .trim(),
          },
          items: [{ offerId: plan.offerId }],
          pixExpiresIn: config.pixExpiresIn,
        },
        idempotencyKey
      );

      await updateFromProvider(localId, payment);

      const code = String(payment?.pix?.qrCode || "");
      if (!code) {
        throw Object.assign(new Error("A Cakto não retornou o código Pix."), { statusCode: 502 });
      }

      const qrImage = await QRCode.toDataURL(code, {
        width: 280,
        margin: 1,
      });

      return res.status(201).json({
        paymentId: localId,
        status: payment.status || "waiting_payment",
        amount: payment.amount || null,
        refId: payment.refId || null,
        pix: {
          copyPaste: code,
          expiresAt: payment.pix?.expirationDate || null,
          qrImage,
        },
      });
    } catch (error) {
      return res.status(error?.statusCode || 500).json({
        error: "pix_payment_failed",
        message: error?.message || "Não foi possível gerar o Pix.",
      });
    }
  });

  app.post("/api/checkout/card", requireUser, async (req, res) => {
    const config = checkoutConfig();
    const plan = checkoutPlan(req.body?.planKey);

    if (!config.configured || !plan?.available) {
      return res.status(503).json({
        error: "checkout_not_configured",
        message: "Checkout ainda não configurado.",
      });
    }

    if (req.body?.cardNumber != null || req.body?.cvv != null) {
      return res.status(400).json({
        error: "raw_card_rejected",
        message: "Dados completos do cartão devem ser tokenizados no navegador.",
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
      const buyer = cleanBuyer(req.body);
      const cardToken = String(req.body?.cardToken || "").trim().slice(0, 512);
      const antifraudReference = String(req.body?.antifraudReference || "").trim().slice(0, 512);
      const holderName = String(req.body?.cardHolderName || "").trim().slice(0, 160);
      const expiry = String(req.body?.cardExpiry || "").trim().slice(0, 12);
      const last4 = digitsOnly(req.body?.cardLast4).slice(-4);
      const installments = Math.max(
        1,
        Math.min(12, Math.trunc(Number(req.body?.installments || 1)))
      );

      const threeDSecure = {
        cavv: String(req.body?.threeDSecure?.cavv || "").slice(0, 512),
        eci: String(req.body?.threeDSecure?.eci || "").slice(0, 32),
        xid: String(req.body?.threeDSecure?.xid || "").slice(0, 512),
        referenceId: String(req.body?.threeDSecure?.referenceId || "").slice(0, 512),
        version: String(req.body?.threeDSecure?.version || "").slice(0, 32),
        dataOnly: Boolean(req.body?.threeDSecure?.dataOnly),
      };

      if (!cardToken || !antifraudReference) {
        throw Object.assign(new Error("Tokenização ou antifraude incompletos."), { statusCode: 400 });
      }

      if (!threeDSecure.referenceId || !threeDSecure.version) {
        throw Object.assign(new Error("Autenticação 3DS incompleta."), { statusCode: 400 });
      }

      if (holderName.length < 3 || !/^\s*(0[1-9]|1[0-2])\s*\/\s*(\d{2}|\d{4})\s*$/.test(expiry) || !/^\d{4}$/.test(last4)) {
        throw Object.assign(new Error("Dados do cartão inválidos."), { statusCode: 400 });
      }

      const localId = await createIntent({
        userId: req.userId,
        idempotencyKey,
        method: "threeDs",
        buyer,
        plan,
        installments,
        card: {
          holderName,
          last4,
          expiry,
        },
      });

      const payment = await createPayment(
        {
          paymentMethod: "threeDs",
          customer: {
            ...buyer.providerCustomer,
            name: holderName,
            ip: String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "")
              .split(",")[0]
              .trim(),
          },
          items: [{ offerId: plan.offerId }],
          address: buyer.providerAddress,
          card: { token: cardToken },
          threeDSecure,
          installments,
          antifraud_profiling_attempt_reference: antifraudReference,
        },
        idempotencyKey
      );

      await updateFromProvider(localId, payment, {
        cardLast4: last4,
      });

      const status = String(payment.status || "").toLowerCase();

      if (status === "paid") {
        await activate(localId, payment.paidAt || null);
      }

      return res.status(201).json({
        paymentId: localId,
        status: payment.status || "pending",
        amount: payment.amount || null,
        refId: payment.refId || null,
        account: status === "paid" ? await accountSnapshot(req.userId) : null,
      });
    } catch (error) {
      return res.status(error?.statusCode || 500).json({
        error: "card_payment_failed",
        message: error?.message || "Não foi possível processar o cartão.",
      });
    }
  });

  app.get("/api/checkout/payments/:id", requireUser, async (req, res) => {
    const paymentId = Number(req.params.id);

    if (!Number.isInteger(paymentId) || paymentId <= 0) {
      return res.status(400).json({ error: "invalid_payment" });
    }

    const result = await pool.query(
      `SELECT
         id, payment_method, status, amount, provider_ref_id,
         pix_expires_at, paid_at, card_brand, card_last4,
         plan_key, plan_name, plan_days, plan_lifetime
       FROM checkout_payments
       WHERE id = $1 AND user_id = $2
       LIMIT 1`,
      [paymentId, req.userId]
    );

    const payment = result.rows[0];

    if (!payment) {
      return res.status(404).json({ error: "payment_not_found" });
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

  app.post("/api/webhooks/cakto", async (req, res) => {
    if (!pool) {
      return res.status(503).send("database_unavailable");
    }

    if (!process.env.CAKTO_WEBHOOK_SECRET) {
      return res.status(503).send("webhook_not_configured");
    }

    if (!verifyWebhook(req.rawBody, req.headers, req.body)) {
      return res.status(401).send("unauthorized");
    }

    const event = String(req.body?.event || "");
    const entries = Array.isArray(req.body?.data)
      ? req.body.data
      : [req.body?.data];

    try {
      for (const order of entries) {
        const providerOrderId = String(order?.id || "").trim();
        if (!providerOrderId) continue;

        const localResult = await pool.query(
          "SELECT id FROM checkout_payments WHERE provider_order_id = $1 LIMIT 1",
          [providerOrderId]
        );

        const localId = Number(localResult.rows[0]?.id || 0);
        if (!localId) continue;

        await updateFromProvider(localId, order, {
          cardBrand: order?.card?.brand || null,
          cardLast4: order?.card?.lastDigits || order?.card?.last4 || null,
        });

        if (event === "purchase_approved" || String(order?.status || "").toLowerCase() === "paid") {
          await activate(localId, order?.paidAt || null);
        } else if (event === "refund" || event === "chargeback") {
          await reverse(
            localId,
            event,
            order?.refundedAt || order?.chargedbackAt || null
          );
        } else if (event === "purchase_refused") {
          await pool.query(
            "UPDATE checkout_payments SET status = $2, updated_at = NOW() WHERE id = $1",
            [localId, order?.status || "refused"]
          );
        }
      }

      return res.sendStatus(200);
    } catch (error) {
      console.error("Falha ao processar webhook Cakto:", error?.message || error);
      return res.sendStatus(500);
    }
  });
}
