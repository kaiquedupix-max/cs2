const checkoutForm = document.getElementById("checkoutForm");
const message = document.getElementById("checkoutMessage");
const cardTab = document.getElementById("cardTab");
const pixTab = document.getElementById("pixTab");
const cardPanel = document.getElementById("cardPanel");
const pixPanel = document.getElementById("pixPanel");

let caktoSdk = null;
let checkoutConfig = null;
let cardIntent = crypto.randomUUID();
let pixIntent = crypto.randomUUID();
let pixPollTimer = null;

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      location.href = "/account#login";
    }
    throw new Error(data.message || data.error || "Não foi possível concluir.");
  }

  return data;
}

function browserFingerprint() {
  const key = "lb_checkout_fingerprint";
  let value = localStorage.getItem(key);

  if (!value) {
    value = "fp_" + crypto.randomUUID();
    localStorage.setItem(key, value);
  }

  return value;
}

function buyerPayload() {
  return {
    fullName: document.getElementById("buyerName").value,
    cpf: document.getElementById("buyerCpf").value,
    email: document.getElementById("buyerEmail").value,
    phone: document.getElementById("buyerPhone").value,
    processNumber: document.getElementById("processNumber").value,
    fingerprint: browserFingerprint(),
    address: {
      street: document.getElementById("billingStreet").value,
      number: document.getElementById("billingNumber").value,
      complement: document.getElementById("billingComplement").value,
      city: document.getElementById("billingCity").value,
      state: document.getElementById("billingState").value.toUpperCase(),
      zipcode: document.getElementById("billingZip").value,
    },
  };
}

function setMessage(text, kind = "") {
  message.textContent = text;
  message.className = "form-message" + (kind ? " " + kind : "");
}

function setMethod(method) {
  const card = method === "card";
  cardTab.classList.toggle("active", card);
  pixTab.classList.toggle("active", !card);
  cardPanel.classList.toggle("hidden", !card);
  pixPanel.classList.toggle("hidden", card);

  ["cardNumber", "cardHolder", "cardExpiry", "cardCvv"].forEach((id) => {
    document.getElementById(id).required = card;
  });

  setMessage("");
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

cardTab.addEventListener("click", () => setMethod("card"));
pixTab.addEventListener("click", () => setMethod("pix"));

document.getElementById("buyerCpf").addEventListener("input", (event) => {
  let value = onlyDigits(event.target.value).slice(0, 11);
  value = value
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
  event.target.value = value;
});

document.getElementById("buyerPhone").addEventListener("input", (event) => {
  const digits = onlyDigits(event.target.value).slice(0, 11);

  if (digits.length > 6) {
    event.target.value = digits.replace(/^(\d{2})(\d{5})(\d+)/, "($1) $2-$3");
  } else if (digits.length > 2) {
    event.target.value = digits.replace(/^(\d{2})(\d+)/, "($1) $2");
  } else {
    event.target.value = digits;
  }
});

document.getElementById("billingZip").addEventListener("input", (event) => {
  const digits = onlyDigits(event.target.value).slice(0, 8);
  event.target.value = digits.length > 5
    ? digits.slice(0, 5) + "-" + digits.slice(5)
    : digits;
});

document.getElementById("billingState").addEventListener("input", (event) => {
  event.target.value = event.target.value.replace(/[^a-zA-Z]/g, "").slice(0, 2).toUpperCase();
});

document.getElementById("cardNumber").addEventListener("input", (event) => {
  const digits = onlyDigits(event.target.value).slice(0, 19);
  event.target.value = digits.replace(/(.{4})/g, "$1 ").trim();
});

document.getElementById("cardExpiry").addEventListener("input", (event) => {
  let digits = onlyDigits(event.target.value).slice(0, 6);
  if (digits.length > 2) {
    digits = digits.slice(0, 2) + "/" + digits.slice(2);
  }
  event.target.value = digits;
});

document.getElementById("cardCvv").addEventListener("input", (event) => {
  event.target.value = onlyDigits(event.target.value).slice(0, 4);
});

checkoutForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (cardPanel.classList.contains("hidden")) {
    return;
  }

  if (!checkoutForm.reportValidity()) {
    return;
  }

  if (!caktoSdk || !checkoutConfig?.configured) {
    setMessage("Checkout da Cakto ainda não configurado.", "error");
    return;
  }

  const button = document.getElementById("payCardBtn");
  button.disabled = true;
  button.textContent = "Processando...";
  setMessage("");

  try {
    const buyer = buyerPayload();
    const cardNumber = onlyDigits(document.getElementById("cardNumber").value);
    const cvv = onlyDigits(document.getElementById("cardCvv").value);
    const expiry = document.getElementById("cardExpiry").value.trim();
    const [expMonth, expYear] = expiry.split("/");

    const card = {
      holderName: document.getElementById("cardHolder").value.trim(),
      cardNumber,
      cvv,
      expMonth: expMonth || "",
      expYear: expYear || "",
    };

    const tokenized = await caktoSdk.createToken(card);
    if (!tokenized?.cardToken) {
      throw new Error("Não foi possível tokenizar o cartão.");
    }

    const authResult = await caktoSdk.authenticate3DS({
      card,
      customer: {
        amount: checkoutConfig.plan.priceCents,
        currency: "BRL",
        email: buyer.email,
        name: buyer.fullName,
        phone: onlyDigits(buyer.phone),
        paymentMethod: "credit",
        address: buyer.address,
      },
    });

    if (!authResult?.success) {
      throw new Error(authResult?.error || "Falha na autenticação 3DS.");
    }

    await caktoSdk.completeAntifraudProfile();
    const antifraudReference = caktoSdk.getAntifraudReference();

    if (!antifraudReference) {
      throw new Error("Não foi possível concluir a análise antifraude.");
    }

    const result = await api("/api/checkout/card", {
      method: "POST",
      body: JSON.stringify({
        ...buyer,
        idempotencyKey: cardIntent,
        cardToken: tokenized.cardToken,
        threeDSecure: {
          cavv: authResult.cavv || "",
          eci: authResult.eci || "",
          xid: authResult.xid || "",
          referenceId: authResult.referenceId || "",
          version: authResult.version || "",
          dataOnly: Boolean(authResult.dataOnly),
        },
        antifraudReference,
        cardHolderName: card.holderName,
        cardExpiry: expiry,
        cardLast4: cardNumber.slice(-4),
        installments: Number(document.getElementById("installments").value || 1),
      }),
    });

    caktoSdk.cleanupAntifraud?.();

    const status = String(result.status || "").toLowerCase();

    if (status === "paid") {
      cardIntent = crypto.randomUUID();
      document.getElementById("cardNumber").value = "";
      document.getElementById("cardCvv").value = "";
      setMessage("Pagamento aprovado. Seu acesso já foi ativado.", "success");
      setTimeout(() => {
        location.href = "/account";
      }, 1200);
      return;
    }

    if (status === "pending") {
      setMessage("Pagamento enviado e aguardando confirmação.");
      startPaymentPolling(result.paymentId, "card");
      return;
    }

    throw new Error("Pagamento não aprovado. Status: " + (result.status || "recusado") + ".");
  } catch (error) {
    setMessage(error.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = "Pagar com cartão";
  }
});

document.getElementById("generatePixBtn").addEventListener("click", async () => {
  setMethod("pix");

  if (!checkoutForm.reportValidity()) {
    return;
  }

  if (!checkoutConfig?.configured) {
    setMessage("Checkout da Cakto ainda não configurado.", "error");
    return;
  }

  const button = document.getElementById("generatePixBtn");
  button.disabled = true;
  button.textContent = "Gerando...";
  setMessage("");

  try {
    const result = await api("/api/checkout/pix", {
      method: "POST",
      body: JSON.stringify({
        ...buyerPayload(),
        idempotencyKey: pixIntent,
      }),
    });

    pixIntent = crypto.randomUUID();

    document.getElementById("pixQr").src = result.pix.qrImage;
    document.getElementById("pixCode").value = result.pix.copyPaste;
    document.getElementById("pixExpiry").textContent = result.pix.expiresAt
      ? "Expira em " + new Date(result.pix.expiresAt).toLocaleString("pt-BR")
      : "";

    document.getElementById("pixResult").classList.remove("hidden");
    startPaymentPolling(result.paymentId, "pix");
  } catch (error) {
    setMessage(error.message, "error");
  } finally {
    button.disabled = false;
    button.textContent = "Gerar PIX";
  }
});

document.getElementById("copyPixBtn").addEventListener("click", async () => {
  const input = document.getElementById("pixCode");
  await navigator.clipboard.writeText(input.value);

  const button = document.getElementById("copyPixBtn");
  button.textContent = "Copiado";
  setTimeout(() => {
    button.textContent = "Copiar";
  }, 1200);
});

function startPaymentPolling(paymentId, method) {
  if (pixPollTimer) {
    clearInterval(pixPollTimer);
  }

  const statusBox = document.getElementById("pixStatus");

  if (method === "pix") {
    statusBox.textContent = "Aguardando pagamento...";
    statusBox.className = "payment-status waiting";
  }

  pixPollTimer = setInterval(async () => {
    try {
      const data = await api("/api/checkout/payments/" + paymentId);
      const status = String(data.payment.status || "").toLowerCase();

      if (status === "paid") {
        clearInterval(pixPollTimer);

        if (method === "pix") {
          statusBox.textContent = "Pagamento aprovado. Acesso ativado!";
          statusBox.className = "payment-status paid";
        } else {
          setMessage("Pagamento aprovado. Seu acesso já foi ativado.", "success");
        }

        setTimeout(() => {
          location.href = "/account";
        }, 1200);
      }

      if (["declined", "refused", "canceled", "refund", "chargeback"].includes(status)) {
        clearInterval(pixPollTimer);

        if (method === "pix") {
          statusBox.textContent = "Pagamento não concluído.";
          statusBox.className = "payment-status failed";
        } else {
          setMessage("Pagamento não aprovado.", "error");
        }
      }
    } catch {
      // Mantém o polling: o webhook pode confirmar em uma tentativa seguinte.
    }
  }, 3000);
}

async function boot() {
  try {
    checkoutConfig = await api("/api/checkout/config");

    document.getElementById("summaryPlan").textContent = checkoutConfig.plan.name;
    document.getElementById("summaryDays").textContent = checkoutConfig.plan.days + " dias";
    document.getElementById("summaryPrice").textContent = checkoutConfig.plan.priceCents
      ? (checkoutConfig.plan.priceCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
      : "—";

    const profile = checkoutConfig.profile || {};
    document.getElementById("buyerName").value = profile.fullName || "";
    document.getElementById("buyerCpf").value = profile.cpf || "";
    document.getElementById("buyerEmail").value = profile.email || "";
    document.getElementById("buyerPhone").value = profile.phone || "";
    document.getElementById("processNumber").value = profile.processNumber || "";

    const address = profile.address || {};
    document.getElementById("billingStreet").value = address.street || "";
    document.getElementById("billingNumber").value = address.number || "";
    document.getElementById("billingComplement").value = address.complement || "";
    document.getElementById("billingCity").value = address.city || "";
    document.getElementById("billingState").value = address.state || "";
    document.getElementById("billingZip").value = address.zipcode || "";

    if (!checkoutConfig.configured) {
      setMessage("Adicione as variáveis da Cakto no Railway para habilitar cobranças reais.", "error");
      return;
    }

    if (!window.Cakto?.CaktoSDK) {
      throw new Error("SDK da Cakto indisponível.");
    }

    caktoSdk = new Cakto.CaktoSDK({
      client_id: checkoutConfig.sdkClientId,
    });

    await caktoSdk.initAntifraud();
  } catch (error) {
    setMessage(error.message, "error");
  }
}

boot();
