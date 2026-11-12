import crypto from "node:crypto";

export function stripeReady() {
  return /^sk_(test|live)_/.test(String(process.env.STRIPE_SECRET_KEY || "")) &&
    /^whsec_/.test(String(process.env.STRIPE_WEBHOOK_SECRET || ""));
}

export async function stripeRequest(path, params, idempotencyKey) {
  const secret = String(process.env.STRIPE_SECRET_KEY || "").trim();
  if (!secret) throw Object.assign(Error("stripe_not_configured"), { statusCode: 503 });
  const response = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: params ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${secret}`,
      ...(params ? { "Content-Type": "application/x-www-form-urlencoded", "Idempotency-Key": idempotencyKey || crypto.randomUUID() } : {}),
    },
    body: params?.toString(),
    signal: AbortSignal.timeout(20000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(Error(data?.error?.message || "stripe_request_failed"), { statusCode: 502 });
  return data;
}
