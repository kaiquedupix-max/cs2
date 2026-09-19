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

export function checkoutConfig() {
  const priceCents = Number(process.env.CAKTO_PLAN_PRICE_CENTS || 0);
  return {
    configured: Boolean(
      process.env.CAKTO_API_CLIENT_ID &&
      process.env.CAKTO_API_CLIENT_SECRET &&
      process.env.CAKTO_SDK_CLIENT_ID &&
      process.env.CAKTO_OFFER_ID &&
      Number.isInteger(priceCents) &&
      priceCents > 0
    ),
    sdkClientId: process.env.CAKTO_SDK_CLIENT_ID || "",
    offerId: process.env.CAKTO_OFFER_ID || "",
    planName: String(process.env.CAKTO_PLAN_NAME || "mensal").slice(0, 40),
    planDays: Math.max(1, Math.min(3650, Math.trunc(Number(process.env.CAKTO_PLAN_DAYS || 30)) || 30)),
    priceCents: Number.isInteger(priceCents) && priceCents > 0 ? priceCents : 0,
    pixExpiresIn: Math.max(60, Math.min(86400, Math.trunc(Number(process.env.CAKTO_PIX_EXPIRES_IN || 900)) || 900)),
  };
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
