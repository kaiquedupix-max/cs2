import crypto from "node:crypto";

const PLANS = [
  { key: "d1", name: "1 dia", days: 1, priceCents: 590 },
  { key: "d7", name: "7 dias", days: 7, priceCents: 990 },
  { key: "d15", name: "15 dias", days: 15, priceCents: 1490 },
  { key: "d30", name: "1 mês", days: 30, priceCents: 1990 },
  { key: "d90", name: "3 meses", days: 90, priceCents: 3990 },
  { key: "d180", name: "6 meses", days: 180, priceCents: 6490 },
  { key: "lifetime", name: "Lifetime", days: null, lifetime: true, priceCents: 10000 },
];

const COUNTERFRAME_PLANS = [
  { key: "d1", name: "1 dia", days: 1, priceCents: 490, usdPriceCents: 150 },
  { key: "d7", name: "7 dias", days: 7, priceCents: 1290, usdPriceCents: 400 },
  { key: "d15", name: "15 dias", days: 15, priceCents: 2190, usdPriceCents: 700 },
  { key: "d30", name: "30 dias", days: 30, priceCents: 3500, usdPriceCents: 1000 },
];

export function normalizeMarket(value) {
  return String(value || "br").trim().toLowerCase() === "intl" ? "INTL" : "BR";
}

export function internationalBrlRate() {
  const rate = Number(process.env.CF_USD_BRL_RATE || 0);
  return Number.isFinite(rate) && rate >= 1 && rate <= 20 ? rate : null;
}

function quotePlan(plan, product, market) {
  if (normalizeProduct(product) !== "counterframe" || normalizeMarket(market) !== "INTL") {
    return { ...plan };
  }
  const rate = internationalBrlRate();
  return {
    ...plan,
    // Mercado Pago BR settles BRL; display USD as a reference, and show BRL
    // settlement amount BEFORE confirming payment.
    priceCents: rate ? Math.round(plan.usdPriceCents * rate) : null,
    settlementCurrency: "BRL",
    billedInBrl: true,
  };
}

export function normalizeProduct(value) {
  const product = String(value || "cs2").trim().toLowerCase();
  if (product === "cf" || product === "counterframe") return "counterframe";
  return "cs2";
}

export function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

export function normalizePhone(value) {
  const digits = digitsOnly(value);
  if (!digits) return "";
  return digits.startsWith("55") ? "+" + digits : "+55" + digits;
}

export function validCpf(value) {
  const cpf = digitsOnly(value);
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;

  const digit = (base, factor) => {
    let sum = 0;
    for (const char of base) sum += Number(char) * factor--;
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };

  return digit(cpf.slice(0, 9), 10) === Number(cpf[9]) &&
    digit(cpf.slice(0, 10), 11) === Number(cpf[10]);
}

export function checkoutConfig(product = "cs2", market = "BR") {
  const publicKey = String(process.env.MP_PUBLIC_KEY || "").trim();
  const accessToken = String(process.env.MP_ACCESS_TOKEN || "").trim();
  const webhookSecret = String(process.env.MP_WEBHOOK_SECRET || "").trim();
  const publicUrl = String(process.env.PUBLIC_URL || "").trim().replace(/\/$/, "");

  const configured = Boolean(
    publicKey.length > 10 &&
    accessToken.length > 10 &&
    webhookSecret.length >= 8 &&
    /^https?:\/\//i.test(publicUrl)
  );

  const intl = normalizeProduct(product) === "counterframe" && normalizeMarket(market) === "INTL";
  const settlementConfigured = !intl || Boolean(internationalBrlRate());
  return {
    configured: configured && settlementConfigured,
    publicKey,
    publicUrl,
    market: intl ? "INTL" : "BR",
    settlementCurrency: "BRL",
    plans: (normalizeProduct(product) === "counterframe" ? COUNTERFRAME_PLANS : PLANS)
      .map((plan) => ({ ...quotePlan(plan, product, market), available: configured && settlementConfigured })),
  };
}

export function checkoutPlan(key, product = "cs2", market = "BR") {
  const normalized = String(key || "d30").trim().toLowerCase();
  const plans = normalizeProduct(product) === "counterframe" ? COUNTERFRAME_PLANS : PLANS;
  const selected = plans.find((plan) => plan.key === normalized);
  return selected ? quotePlan(selected, product, market) : null;
}

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

export function verifyWebhook(headers, dataId) {
  const secret = String(process.env.MP_WEBHOOK_SECRET || "").trim();
  if (!secret) return false;

  const parts = Object.fromEntries(
    String(headers["x-signature"] || "")
      .split(",")
      .map((item) => item.trim().split("="))
      .filter((pair) => pair.length === 2)
  );

  const requestId = String(headers["x-request-id"] || "");
  const id = String(dataId || "").toLowerCase();

  if (!parts.ts || !parts.v1 || !requestId || !id) return false;

  const manifest = "id:" + id + ";request-id:" + requestId + ";ts:" + parts.ts + ";";
  const expected = crypto
    .createHmac("sha256", secret)
    .update(manifest)
    .digest("hex");

  return safeEqual(parts.v1, expected);
}

async function mpRequest(route, options = {}) {
  const accessToken = String(process.env.MP_ACCESS_TOKEN || "").trim();
  if (!accessToken) throw Object.assign(new Error("Mercado Pago não configurado."), { statusCode: 503 });

  const response = await fetch("https://api.mercadopago.com" + route, {
    ...options,
    headers: {
      Authorization: "Bearer " + accessToken,
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const message = String(
      data?.message ||
      data?.error ||
      data?.cause?.[0]?.description ||
      "O Mercado Pago não conseguiu concluir a operação."
    );
    throw Object.assign(new Error(message), { statusCode: 502, providerStatus: response.status });
  }

  return data;
}

export function normalizePaymentStatus(status) {
  const raw = String(status || "").toLowerCase();
  if (raw === "approved") return "paid";
  if (["pending", "in_process", "authorized"].includes(raw)) return "pending";
  if (raw === "rejected") return "declined";
  if (raw === "cancelled") return "canceled";
  if (raw === "refunded") return "refund";
  if (raw === "charged_back") return "chargeback";
  return raw || "pending";
}

export function paymentView(payment) {
  const transaction = payment?.point_of_interaction?.transaction_data || {};
  return {
    id: payment?.id != null ? String(payment.id) : null,
    externalId: payment?.external_reference || null,
    refId: payment?.id != null ? String(payment.id) : null,
    status: normalizePaymentStatus(payment?.status),
    rawStatus: String(payment?.status || ""),
    statusDetail: String(payment?.status_detail || ""),
    amount: Number(payment?.transaction_amount || 0),
    paidAt: payment?.date_approved || null,
    cardBrand: payment?.payment_method_id || null,
    cardLast4: payment?.card?.last_four_digits || null,
    pix: {
      qrCode: String(transaction.qr_code || ""),
      qrCodeBase64: String(transaction.qr_code_base64 || ""),
      ticketUrl: String(transaction.ticket_url || ""),
      expirationDate: payment?.date_of_expiration || null,
    },
    metadata: payment?.metadata || {},
  };
}

export async function createPayment({
  userId,
  localId,
  plan,
  buyer,
  formData,
  idempotencyKey,
  deviceId,
  product = "cs2",
  platform = "windows",
  market = "BR",
}) {
  const config = checkoutConfig(product, market);
  if (!config.configured) {
    throw Object.assign(new Error("Mercado Pago ainda não configurado."), { statusCode: 503 });
  }

  if (!plan) {
    throw Object.assign(new Error("Plano inválido."), { statusCode: 400 });
  }

  const input = formData && typeof formData === "object" ? formData : {};
  const paymentMethodId = String(input.payment_method_id || "").trim();
  if (!paymentMethodId) {
    throw Object.assign(new Error("Escolha uma forma de pagamento."), { statusCode: 400 });
  }

  const suppliedIdentification = input.payer?.identification;
  const identification = validCpf(buyer.cpf)
    ? { type: "CPF", number: digitsOnly(buyer.cpf) }
    : suppliedIdentification?.type && suppliedIdentification?.number
      ? { type: String(suppliedIdentification.type).slice(0, 24),
          number: String(suppliedIdentification.number).slice(0, 64) }
      : null;

  const payer = {
    ...(input.payer && typeof input.payer === "object" ? input.payer : {}),
    email: buyer.email.trim().toLowerCase(),
    ...(identification ? { identification } : {}),
  };

  const payload = {
    transaction_amount: Number((plan.priceCents / 100).toFixed(2)),
    description: "Legit Baratinho - " +
      (normalizeProduct(product) === "counterframe" ? "Counter Flame " + platform : "CS2") +
      " - " + plan.name,
    payment_method_id: paymentMethodId,
    payer,
    external_reference: "lb:" + userId + ":" + localId + ":" + plan.key,
    metadata: {
      user_id: String(userId),
      local_payment_id: String(localId),
      plan_key: plan.key,
      product_code: normalizeProduct(product) === "counterframe" ? "counterframe-" + platform : "cs2",
      platform: platform,
    },
    notification_url: config.publicUrl + "/api/webhooks/mercadopago",
    binary_mode: false,
  };

  for (const key of ["token", "installments", "issuer_id"]) {
    if (input[key] !== undefined && input[key] !== null && input[key] !== "") {
      payload[key] = input[key];
    }
  }

  const sessionId = String(deviceId || "").trim();
  const payment = await mpRequest("/v1/payments", {
    method: "POST",
    headers: {
      "X-Idempotency-Key": idempotencyKey,
      ...(sessionId ? { "X-meli-session-id": sessionId } : {}),
    },
    body: JSON.stringify(payload),
  });

  return payment;
}

export async function getPayment(paymentId) {
  const id = encodeURIComponent(String(paymentId || "").trim());
  if (!id) throw Object.assign(new Error("Pagamento inválido."), { statusCode: 400 });
  return mpRequest("/v1/payments/" + id, { method: "GET" });
}


// Bot payments (Telegram). Pix charges need a CPF; card goes through a Checkout Pro preference.
export function mercadoPagoBotReady() {
  return checkoutConfig("counterframe", "BR").configured;
}

export async function createBotPixPayment({ amountCents, description, telegramId, cpf, externalReference, idempotencyKey }) {
  const config = checkoutConfig("counterframe", "BR");
  if (!config.configured) throw Object.assign(new Error("Mercado Pago ainda não configurado."), { statusCode: 503 });
  if (!validCpf(cpf)) throw Object.assign(new Error("CPF inválido."), { statusCode: 400 });
  return mpRequest("/v1/payments", {
    method: "POST",
    headers: { "X-Idempotency-Key": idempotencyKey },
    body: JSON.stringify({
      transaction_amount: Number((amountCents / 100).toFixed(2)),
      description,
      payment_method_id: "pix",
      payer: {
        // Telegram buyers have no e-mail on the site; MP only needs an address for the payer record.
        email: "telegram" + String(telegramId).replace(/\D/g, "") + "@legitbaratinho.xyz",
        identification: { type: "CPF", number: digitsOnly(cpf) },
      },
      external_reference: externalReference,
      metadata: { bot_payment: externalReference },
      notification_url: config.publicUrl + "/api/webhooks/mercadopago",
      binary_mode: false,
    }),
  });
}

export async function createBotCardPreference({ amountCents, title, externalReference, backUrl, idempotencyKey }) {
  const config = checkoutConfig("counterframe", "BR");
  if (!config.configured) throw Object.assign(new Error("Mercado Pago ainda não configurado."), { statusCode: 503 });
  const preference = await mpRequest("/checkout/preferences", {
    method: "POST",
    headers: { "X-Idempotency-Key": idempotencyKey },
    body: JSON.stringify({
      items: [{ title, quantity: 1, unit_price: Number((amountCents / 100).toFixed(2)), currency_id: "BRL" }],
      external_reference: externalReference,
      notification_url: config.publicUrl + "/api/webhooks/mercadopago",
      back_urls: { success: backUrl, pending: backUrl, failure: backUrl },
      payment_methods: { excluded_payment_types: [{ id: "ticket" }] },
      statement_descriptor: "COUNTER FLAME",
    }),
  });
  return preference;
}

export async function searchBotPaymentsByReference(externalReference) {
  const data = await mpRequest("/v1/payments/search?sort=date_created&criteria=desc&external_reference=" +
    encodeURIComponent(externalReference), { method: "GET" });
  return Array.isArray(data?.results) ? data.results : [];
}
