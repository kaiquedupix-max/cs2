import crypto from "node:crypto";
import {checkoutConfig, createBotPixPayment, createBotCardPreference, searchBotPaymentsByReference, getPayment, validCpf, mercadoPagoBotReady} from "./mercadoPago.js";
import {stripeReady, stripeRequest} from "./stripeApi.js";

// Brazilian buyers pay 30% less in BRL. Stars prices stay in CF_TELEGRAM_PLANS.
export const BR_DISCOUNT_PERCENT = 30;
export const BOT_PLANS = [
  { key: "d1", days: 1, lifetime: false, priceCents: 500 },
  { key: "d7", days: 7, lifetime: false, priceCents: 1200 },
  { key: "d15", days: 15, lifetime: false, priceCents: 1800 },
  { key: "d30", days: 30, lifetime: false, priceCents: 3000 },
  { key: "lifetime", days: 0, lifetime: true, priceCents: 5000 },
];

export const botPlan = key => BOT_PLANS.find(plan => plan.key === key) || null;
export const botAmount = (plan, couponPercent = 0) => {
  const base = Math.round(plan.priceCents * (100 - BR_DISCOUNT_PERCENT) / 100);
  return Math.max(100, Math.round(base * (100 - couponPercent) / 100));
};

const T = {
  pt: { cardLabelMp: "Cartão (Mercado Pago)", cardLabelStripe: "Cartão (Stripe)", off: "Essa forma de pagamento não está disponível agora.", permanent: "Permanente", day: "dia", days: "dias", payMethod: "Escolha a forma de pagamento:", pixCpf: "Envie seu CPF (somente números) para gerar o PIX. O bot não guarda o CPF.", cpfInvalid: "CPF inválido. Envie novamente, somente números.", pixReady: "PIX gerado. Copie o código abaixo e pague no app do seu banco. A key chega aqui após a confirmação.", pixExpires: "Expira em", cardReady: "Pague com cartão pelo botão abaixo. A key chega aqui após a confirmação.", payCard: "Pagar com cartão", check: "Verificar pagamento", pending: "Pagamento ainda não confirmado. Tente novamente em instantes.", alreadyPaid: "Este pedido já foi pago. Veja suas keys em \"Minhas keys\".", paid: "Pagamento confirmado. Sua key:", activate: "Crie sua conta no loader e ative esta key. Ela fica vinculada ao primeiro aparelho.", error: "Não foi possível concluir. Tente novamente." },
  en: { cardLabelMp: "Card (Mercado Pago)", cardLabelStripe: "Card (Stripe)", off: "This payment method is not available right now.", permanent: "Lifetime", day: "day", days: "days", payMethod: "Choose a payment method:", pixCpf: "Send your CPF (numbers only) to generate the PIX. The bot does not store it.", cpfInvalid: "Invalid CPF. Send again, numbers only.", pixReady: "PIX generated. Copy the code below and pay in your banking app. The key arrives here after confirmation.", pixExpires: "Expires at", cardReady: "Pay by card with the button below. The key arrives here after confirmation.", payCard: "Pay by card", check: "Check payment", pending: "Payment not confirmed yet. Try again in a moment.", alreadyPaid: "This order is already paid. See your keys under \"My keys\".", paid: "Payment confirmed. Your key:", activate: "Create your loader account and activate this key. It binds to the first device.", error: "Unable to complete. Please try again." },
  es: { cardLabelMp: "Tarjeta (Mercado Pago)", cardLabelStripe: "Tarjeta (Stripe)", off: "Esta forma de pago no está disponible ahora.", permanent: "Permanente", day: "día", days: "días", payMethod: "Elige la forma de pago:", pixCpf: "Envía tu CPF (solo números) para generar el PIX. El bot no lo guarda.", cpfInvalid: "CPF inválido. Envíalo de nuevo, solo números.", pixReady: "PIX generado. Copia el código de abajo y paga en tu app bancaria. La key llega aquí tras la confirmación.", pixExpires: "Vence el", cardReady: "Paga con tarjeta con el botón de abajo. La key llega aquí tras la confirmación.", payCard: "Pagar con tarjeta", check: "Verificar pago", pending: "Pago aún no confirmado. Inténtalo de nuevo en unos instantes.", alreadyPaid: "Este pedido ya está pagado. Revisa tus keys en \"Mis keys\".", paid: "Pago confirmado. Tu key:", activate: "Crea tu cuenta en el loader y activa esta key. Queda vinculada al primer dispositivo.", error: "No se pudo completar. Inténtalo de nuevo." },
  ru: { cardLabelMp: "Карта (Mercado Pago)", cardLabelStripe: "Карта (Stripe)", off: "Этот способ оплаты сейчас недоступен.", permanent: "Навсегда", day: "день", days: "дней", payMethod: "Выберите способ оплаты:", pixCpf: "Отправьте ваш CPF (только цифры), чтобы создать PIX. Бот его не сохраняет.", cpfInvalid: "Неверный CPF. Отправьте снова, только цифры.", pixReady: "PIX создан. Скопируйте код ниже и оплатите в банковском приложении. Ключ придёт сюда после подтверждения.", pixExpires: "Действует до", cardReady: "Оплатите картой по кнопке ниже. Ключ придёт сюда после подтверждения.", payCard: "Оплатить картой", check: "Проверить оплату", pending: "Оплата ещё не подтверждена. Попробуйте чуть позже.", alreadyPaid: "Этот заказ уже оплачен. Ключи в разделе «Мои ключи».", paid: "Оплата подтверждена. Ваш ключ:", activate: "Создайте аккаунт в загрузчике и активируйте ключ. Он привязывается к первому устройству.", error: "Не удалось завершить. Попробуйте ещё раз." },
};
export const botText = lang => T[lang] || T.pt;
export const planLabel = (plan, lang) => {
  const text = botText(lang);
  if (plan.lifetime) return text.permanent;
  return plan.days === 1 ? `1 ${text.day}` : `${plan.days} ${text.days}`;
};
export const brl = cents => "R$ " + (cents / 100).toFixed(2).replace(".", ",");

export function botPaymentMethods() {
  const publicUrl = String(process.env.PUBLIC_URL || "").trim();
  return {
    pix: mercadoPagoBotReady(),
    mpCard: mercadoPagoBotReady(),
    stripeCard: stripeReady() && /^https:\/\//i.test(publicUrl),
  };
}

let botApi = null;
export function setBotApi(api) { botApi = api; }

const sha = value => crypto.createHash("sha256").update(String(value)).digest("hex");
function encodeKey(raw) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", crypto.createHash("sha256").update(process.env.SESSION_SECRET).digest(), iv);
  return Buffer.concat([iv, cipher.update(raw, "utf8"), cipher.final(), cipher.getAuthTag()]).toString("base64");
}

export async function createBotOrder(pool, { telegramId, plan, couponPercent = 0, couponCode = "", provider, referrer = null }) {
  const payload = crypto.randomBytes(24).toString("hex");
  const amount = botAmount(plan, couponPercent);
  await pool.query(
    "INSERT INTO cf_bot_orders(payload,telegram_id,days,stars,coupon_code,referrer_telegram_id,lifetime,plan_key,provider,amount_cents,currency,status) VALUES($1,$2,$3,0,$4,$5,$6,$7,$8,$9,'BRL','pending')",
    [payload, telegramId, plan.days, couponCode || null, referrer, plan.lifetime, plan.key, provider, amount]);
  return { payload, amount };
}

// Single place that turns a confirmed BRL payment into a key. Idempotent: the webhook and the
// "check payment" button can both call it; the row lock and the status check issue one key per order.
export async function settleBotOrder(pool, { payload, providerRef, amountCents, currency }, api = botApi) {
  const db = await pool.connect();
  let o, raw;
  try {
    await db.query("BEGIN");
    const r = await db.query("SELECT * FROM cf_bot_orders WHERE payload=$1 AND provider<>'telegram_stars' FOR UPDATE", [payload]);
    o = r.rows[0];
    if (!o) throw Error("order_missing");
    if (o.status === "paid") { await db.query("COMMIT"); return { status: "already_paid", telegramId: String(o.telegram_id) }; }
    if (Number(o.amount_cents) !== Number(amountCents) || String(currency || "").toUpperCase() !== "BRL") throw Error("payment_mismatch");
    raw = "CF-" + crypto.randomBytes(18).toString("hex").toUpperCase();
    const k = await db.query(
      "INSERT INTO cf_keys(key_hash,key_cipher,days,plan,telegram_id,duration_seconds,lifetime) VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id",
      [sha(raw), encodeKey(raw), o.lifetime ? 0 : o.days, o.lifetime ? "Lifetime" : `${o.days}d`, o.telegram_id, o.lifetime ? 0 : o.days * 86400, o.lifetime]);
    await db.query("UPDATE cf_bot_orders SET status='paid',paid_at=NOW(),delivered_at=NOW(),key_id=$2,charge_id=$3 WHERE payload=$1",
      [payload, k.rows[0].id, "brl:" + providerRef]);
    await db.query("COMMIT");
  } catch (error) {
    await db.query("ROLLBACK");
    throw error;
  } finally {
    db.release();
  }
  // The key is stored before the message goes out; "Minhas keys" still shows it if the send fails.
  try {
    const lang = (await pool.query("SELECT language FROM cf_bot_users WHERE telegram_id=$1", [o.telegram_id])).rows[0]?.language || "pt";
    const text = botText(lang);
    await api("sendMessage", { chat_id: String(o.telegram_id), text: `${text.paid}\n${raw}\n\n${text.activate}` });
  } catch (error) {
    console.error("Falha ao enviar key do bot:", error?.message || error);
  }
  return { status: "paid", telegramId: String(o.telegram_id) };
}

// Asks the provider whether an order was paid, and settles it when it was.
export async function confirmBotOrder(pool, o, api = botApi) {
  if (o.provider === "mp_pix" && o.provider_ref) {
    const p = await getPayment(o.provider_ref);
    if (p.status !== "approved") return false;
    await settleBotOrder(pool, { payload: o.payload, providerRef: String(p.id), amountCents: Math.round(Number(p.transaction_amount) * 100), currency: p.currency_id || "BRL" }, api);
    return true;
  }
  if (o.provider === "mp_card") {
    const approved = (await searchBotPaymentsByReference("tg:" + o.payload)).find(p => p.status === "approved");
    if (!approved) return false;
    await settleBotOrder(pool, { payload: o.payload, providerRef: String(approved.id), amountCents: Math.round(Number(approved.transaction_amount) * 100), currency: approved.currency_id || "BRL" }, api);
    return true;
  }
  if (o.provider === "stripe_card" && o.provider_ref) {
    const s = await stripeRequest(`checkout/sessions/${encodeURIComponent(o.provider_ref)}`);
    if (s.payment_status !== "paid") return false;
    await settleBotOrder(pool, { payload: o.payload, providerRef: String(s.payment_intent || s.id), amountCents: Number(s.amount_total), currency: s.currency }, api);
    return true;
  }
  return false;
}

export async function startPixPayment(pool, { telegramId, plan, couponPercent, couponCode, referrer, cpf, lang }) {
  const order = await createBotOrder(pool, { telegramId, plan, couponPercent, couponCode, provider: "mp_pix", referrer });
  const payment = await createBotPixPayment({
    amountCents: order.amount, description: `Counter Flame Android - ${planLabel(plan, lang)}`, telegramId, cpf,
    externalReference: "tg:" + order.payload, idempotencyKey: "tg-pix-" + order.payload,
  });
  const qr = payment?.point_of_interaction?.transaction_data?.qr_code || "";
  await pool.query("UPDATE cf_bot_orders SET provider_ref=$2,pix_copy_paste=$3,pix_expires_at=$4 WHERE payload=$1",
    [order.payload, payment?.id != null ? String(payment.id) : null, qr, payment?.date_of_expiration || null]);
  return { payload: order.payload, qr, expires: payment?.date_of_expiration || null };
}

export async function startMercadoPagoCard(pool, { telegramId, plan, couponPercent, couponCode, referrer, lang, backUrl }) {
  const order = await createBotOrder(pool, { telegramId, plan, couponPercent, couponCode, provider: "mp_card", referrer });
  const preference = await createBotCardPreference({
    amountCents: order.amount, title: `Counter Flame Android - ${planLabel(plan, lang)}`, externalReference: "tg:" + order.payload,
    backUrl, idempotencyKey: "tg-mpcard-" + order.payload,
  });
  await pool.query("UPDATE cf_bot_orders SET provider_ref=$2 WHERE payload=$1", [order.payload, String(preference.id || "")]);
  return { payload: order.payload, url: preference.init_point || preference.sandbox_init_point };
}

export async function startStripeCard(pool, { telegramId, plan, couponPercent, couponCode, referrer, lang, successUrl }) {
  const order = await createBotOrder(pool, { telegramId, plan, couponPercent, couponCode, provider: "stripe_card", referrer });
  const params = new URLSearchParams();
  params.set("mode", "payment");
  params.set("line_items[0][price_data][currency]", "brl");
  params.set("line_items[0][price_data][unit_amount]", String(order.amount));
  params.set("line_items[0][price_data][product_data][name]", `Counter Flame Android - ${planLabel(plan, lang)}`);
  params.set("line_items[0][quantity]", "1");
  params.set("client_reference_id", "tg:" + order.payload);
  params.set("metadata[bot_payload]", order.payload);
  params.set("success_url", successUrl);
  params.set("cancel_url", successUrl);
  const session = await stripeRequest("checkout/sessions", params, "tg-stripe-" + order.payload);
  await pool.query("UPDATE cf_bot_orders SET provider_ref=$2 WHERE payload=$1", [order.payload, session.id]);
  return { payload: order.payload, url: session.url };
}

export { checkoutConfig, validCpf };
