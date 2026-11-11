// Counter Flame only. CS2 deliberately excluded from this bot.
export const PLANS = Object.freeze([
  Object.freeze({ id: "d1", days: 1, brlCents: 490, usdCents: 150 }),
  Object.freeze({ id: "d7", days: 7, brlCents: 1290, usdCents: 400 }),
  Object.freeze({ id: "d15", days: 15, brlCents: 2190, usdCents: 700 }),
  Object.freeze({ id: "d30", days: 30, brlCents: 3500, usdCents: 1000 }),
]);

export function planById(id) {
  return PLANS.find((plan) => plan.id === id) || null;
}

export function displayPrice(plan, market) {
  if (!plan) throw new Error("Unknown plan");
  return market === "BR"
    ? (plan.brlCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
    : "$" + (plan.usdCents / 100).toFixed(2) + " USD";
}

export function parseTelegramStart(payload) {
  const text = String(payload || "").slice(0, 64);
  if (/^ref_[1-9][0-9]{0,18}$/.test(text)) {
    return { type: "referral", userId: text.slice(4) };
  }
  const match = /^cf_(android|ios)_(d1|d7|d15|d30)$/.exec(text);
  return match ? { type: "catalog", platform: match[1], planId: match[2] } : null;
}

