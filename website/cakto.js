import crypto from "node:crypto";

const API_BASE = "https://api.cakto.com.br/public_api";
let tokenCache = { value: "", expiresAt: 0 };

function safeEqual(a, b) {
  const aa = Buffer.from(String(a || ""));
  const bb = Buffer.from(String(b || ""));
  return aa.length === bb.length && crypto.timingSafeEqual(aa, bb);
}

export function digitsOnly(value) {
  return String(value || "").replace(/\D/g, "");
}

export function normalizePhone(value) {
  let phone = digitsOnly(value);
  if (phone.length === 10 || phone.length === 11) phone = "55" + phone;
  return phone;
}

export function validCpf(value) {
  const cpf = digitsOnly(value);
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false;

  const check = (length) => {
    let sum = 0;
    for (let i = 0; i < length; i++) {
      sum += Number(cpf[i]) * (length + 1 - i);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };

  return check(9) === Number(cpf[9]) && check(10) === Number(cpf[10]);
}

const PLAN_DEFINITIONS = [
  { key: "d1", name: "1 dia", days: 1, priceCents: 590, offerEnv: "CAKTO_OFFER_ID_1D" },
  { key: "d7", name: "7 dias", days: 7, priceCents: 990, offerEnv: "CAKTO_OFFER_ID_7D" },
  { key: "d15", name: "15 dias", days: 15, priceCents: 1490, offerEnv: "CAKTO_OFFER_ID_15D" },
  { key: "d30", name: "1 mês", days: 30, priceCents: 1990, offerEnv: "CAKTO_OFFER_ID_30D" },
  { key: "d90", name: "3 meses", days: 90, priceCents: 3990, offerEnv: "CAKTO_OFFER_ID_3M" },
  { key: "d180", name: "6 meses", days: 180, priceCents: 6490, offerEnv: "CAKTO_OFFER_ID_6M" },
  { key: "lifetime", name: "Lifetime", days: null, lifetime: true, priceCents: 10000, offerEnv: "CAKTO_OFFER_ID_LIFETIME" },
];

function planOfferId(plan) {
  if (plan.key === "d30") {
    return String(process.env[plan.offerEnv] || process.env.CAKTO_OFFER_ID || "").trim();
  }
  return String(process.env[plan.offerEnv] || "").trim();
}

export function checkoutConfig() {
  const commonConfigured = Boolean(
    process.env.CAKTO_API_CLIENT_ID &&
    process.env.CAKTO_API_CLIENT_SECRET &&
    process.env.CAKTO_SDK_CLIENT_ID &&
    process.env.CAKTO_WEBHOOK_SECRET
  );

  const plans = PLAN_DEFINITIONS.map((plan) => {
    const offerId = planOfferId(plan);
    return {
      ...plan,
      offerId,
      available: Boolean(commonConfigured && offerId),
    };
  });

  return {
    configured: Boolean(commonConfigured && plans.some((plan) => plan.available)),
    commonConfigured,
    sdkClientId: process.env.CAKTO_SDK_CLIENT_ID || "",
    plans,
    pixExpiresIn: Math.max(60, Math.min(86400, Math.trunc(Number(process.env.CAKTO_PIX_EXPIRES_IN || 900)) || 900)),
  };
}

export function checkoutPlan(key) {
  const normalized = String(key || "d30").trim().toLowerCase();
  return checkoutConfig().plans.find((plan) => plan.key === normalized) || null;
}

export async function getAccessToken() {
  if (!process.env.CAKTO_API_CLIENT_ID || !process.env.CAKTO_API_CLIENT_SECRET) {
    throw Object.assign(new Error("Credenciais da Cakto não configuradas."), { statusCode: 503 });
  }

  if (tokenCache.value && Date.now() < tokenCache.expiresAt - 60000) {
    return tokenCache.value;
  }

  const response = await fetch(API_BASE + "/token/", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.CAKTO_API_CLIENT_ID,
      client_secret: process.env.CAKTO_API_CLIENT_SECRET,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.access_token) {
    throw Object.assign(new Error("Falha ao autenticar na Cakto."), { statusCode: 502 });
  }

  tokenCache = {
    value: data.access_token,
    expiresAt: Date.now() + Math.max(60, Number(data.expires_in || 3600)) * 1000,
  };

  return tokenCache.value;
}

export async function createPayment(payload, idempotencyKey) {
  const token = await getAccessToken();
  const response = await fetch(API_BASE + "/payments/", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      "X-Idempotency-Key": idempotencyKey,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail =
      typeof data.detail === "string"
        ? data.detail
        : typeof data.message === "string"
          ? data.message
          : "A Cakto recusou a cobrança.";
    throw Object.assign(new Error(detail), { statusCode: response.status >= 500 ? 502 : 400 });
  }

  return data;
}

export function verifyWebhook(rawBody, headers, parsedBody) {
  const secret = String(process.env.CAKTO_WEBHOOK_SECRET || "");
  if (!secret) return false;

  const timestamp = String(headers["x-cakto-timestamp"] || "");
  const signatureHeader = String(headers["x-cakto-signature"] || "");

  if (timestamp || signatureHeader) {
    if (!timestamp || !signatureHeader || !Buffer.isBuffer(rawBody)) return false;

    const timestampNumber = Number(timestamp);
    if (!Number.isFinite(timestampNumber) || Math.abs(Date.now() / 1000 - timestampNumber) > 300) {
      return false;
    }

    const signature =
      signatureHeader
        .split(",")
        .map((part) => part.trim())
        .find((part) => part.startsWith("v1=")) || "";

    const expected =
      "v1=" +
      crypto
        .createHmac("sha256", secret)
        .update(timestamp + ".")
        .update(rawBody)
        .digest("hex");

    return safeEqual(signature, expected);
  }

  return safeEqual(String(parsedBody?.secret || ""), secret);
}
