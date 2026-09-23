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

export function checkoutConfig() {
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

  return {
    configured,
    publicKey,
    publicUrl,
    plans: PLANS.map((plan) => ({ ...plan, available: configured })),
  };
}

export function checkoutPlan(key) {
  const normalized = String(key || "d30").trim().toLowerCase();
  return PLANS.find((plan) => plan.key === normalized) || null;
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
}) {
  const config = checkoutConfig();
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

  const payer = {
    ...(input.payer && typeof input.payer === "object" ? input.payer : {}),
    email: buyer.email.trim().toLowerCase(),
    identification: {
      type: "CPF",
      number: digitsOnly(buyer.cpf),
    },
  };

  const payload = {
    transaction_amount: Number((plan.priceCents / 100).toFixed(2)),
    description: "Legit Baratinho - " + plan.name,
    payment_method_id: paymentMethodId,
    payer,
    external_reference: "lb:" + userId + ":" + localId + ":" + plan.key,
    metadata: {
      user_id: String(userId),
      local_payment_id: String(localId),
      plan_key: plan.key,
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
