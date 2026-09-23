const checkoutBox = document.getElementById("checkoutForm");
const message = document.getElementById("checkoutMessage");
const brickContainer = document.getElementById("paymentBrick_container");
const paymentLoading = document.getElementById("paymentLoading");
const pixResult = document.getElementById("pixResult");
const paymentApproved = document.getElementById("paymentApproved");

let checkoutConfig = null;
let selectedPlanKey = new URLSearchParams(location.search).get("plan") || "d30";
let paymentIntent = crypto.randomUUID();
let paymentBrickController = null;
let paymentPollTimer = null;

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) location.href = "/account#login";
    throw new Error(data.message || data.error || "Não foi possível concluir.");
  }
  return data;
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
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

function validateBuyerFields() {
  const required = [...checkoutBox.querySelectorAll("input[required]")];
  for (const input of required) {
    if (!input.checkValidity()) {
      input.reportValidity();
      input.focus();
      return false;
    }
  }
  return true;
}

function setMessage(text, kind = "") {
  message.textContent = text;
  message.className = "form-message" + (kind ? " " + kind : "");
}

function money(cents) {
  return (Number(cents || 0) / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function selectedPlan() {
  return checkoutConfig?.plans?.find((plan) => plan.key === selectedPlanKey) || null;
}

function updatePlanSummary() {
  const plan = selectedPlan();
  if (!plan) return;
  document.getElementById("summaryPlan").textContent = plan.name;
  document.getElementById("summaryDays").textContent = plan.lifetime
    ? "Acesso permanente"
    : plan.days + " dias";
  document.getElementById("summaryPrice").textContent = money(plan.priceCents);
}

async function choosePlan(key) {
  const plan = checkoutConfig?.plans?.find((item) => item.key === key);
  if (!plan || !plan.available) return;

  selectedPlanKey = plan.key;
  paymentIntent = crypto.randomUUID();

  document.querySelectorAll("[data-plan-key]").forEach((button) => {
    button.classList.toggle("selected", button.dataset.planKey === selectedPlanKey);
  });

  updatePlanSummary();
  const url = new URL(location.href);
  url.searchParams.set("plan", selectedPlanKey);
  history.replaceState(null, "", url);

  pixResult.classList.add("hidden");
  paymentApproved.classList.add("hidden");
  brickContainer.classList.remove("hidden");
  await mountPaymentBrick();
}

function renderPlans() {
  const grid = document.getElementById("planGrid");
  const plans = checkoutConfig?.plans || [];
  const requested = plans.find((plan) => plan.key === selectedPlanKey && plan.available);
  const fallback = plans.find((plan) => plan.key === "d30" && plan.available) || plans.find((plan) => plan.available);
  selectedPlanKey = (requested || fallback || plans[0] || {}).key || "d30";

  grid.innerHTML = plans.map((plan) => `
    <button
      type="button"
      class="checkout-plan-card ${plan.key === selectedPlanKey ? "selected" : ""} ${plan.available ? "" : "unavailable"}"
      data-plan-key="${plan.key}"
      ${plan.available ? "" : "disabled"}
    >
      <span>${plan.name}</span>
      <strong>${money(plan.priceCents)}</strong>
      <small>${plan.lifetime ? "Pague uma vez" : plan.days + " dias de acesso"}</small>
    </button>
  `).join("");

  grid.querySelectorAll("[data-plan-key]").forEach((button) => {
    button.addEventListener("click", () => choosePlan(button.dataset.planKey));
  });

  updatePlanSummary();
}

async function destroyPaymentBrick() {
  if (paymentBrickController) {
    try { await paymentBrickController.unmount(); } catch {}
    paymentBrickController = null;
  }
  brickContainer.innerHTML = "";
}

function stopPaymentPolling() {
  if (paymentPollTimer) {
    clearInterval(paymentPollTimer);
    paymentPollTimer = null;
  }
}

async function showApproved() {
  stopPaymentPolling();
  await destroyPaymentBrick();
  pixResult.classList.add("hidden");
  brickContainer.classList.add("hidden");
  paymentLoading.classList.add("hidden");
  paymentApproved.classList.remove("hidden");
  setMessage("");
}

function startPaymentPolling(paymentId) {
  stopPaymentPolling();
  paymentPollTimer = setInterval(async () => {
    try {
      const data = await api("/api/checkout/payments/" + paymentId);
      const status = String(data.payment?.status || "").toLowerCase();

      if (status === "paid") {
        await showApproved();
        return;
      }

      if (["declined", "canceled", "refund", "chargeback"].includes(status)) {
        stopPaymentPolling();
        setMessage("Pagamento não aprovado ou cancelado.", "error");
      }
    } catch {
      // O webhook ou a consulta seguinte pode confirmar o pagamento.
    }
  }, 2500);
}

async function handlePaymentResult(result) {
  const status = String(result.status || "").toLowerCase();

  if (status === "paid") {
    await showApproved();
    return;
  }

  if (result.pix?.copyPaste) {
    await destroyPaymentBrick();
    brickContainer.classList.add("hidden");

    const qr = document.getElementById("pixQr");
    if (result.pix.qrCodeBase64) {
      qr.src = "data:image/png;base64," + result.pix.qrCodeBase64;
      qr.classList.remove("hidden");
    } else {
      qr.classList.add("hidden");
    }

    document.getElementById("pixCode").value = result.pix.copyPaste;
    document.getElementById("pixExpiry").textContent = result.pix.expiresAt
      ? "Expira em " + new Date(result.pix.expiresAt).toLocaleString("pt-BR")
      : "";
    document.getElementById("pixStatus").textContent = "Aguardando pagamento...";
    document.getElementById("pixStatus").className = "payment-status waiting";
    pixResult.classList.remove("hidden");
    setMessage("Pix criado. Escaneie o QR Code ou copie o código abaixo.");
    startPaymentPolling(result.paymentId);
    return;
  }

  if (status === "pending") {
    setMessage("Pagamento enviado. Aguardando confirmação do Mercado Pago.");
    startPaymentPolling(result.paymentId);
    return;
  }

  throw new Error("Pagamento não aprovado. Status: " + (result.rawStatus || result.status || "recusado") + ".");
}

async function mountPaymentBrick() {
  stopPaymentPolling();
  await destroyPaymentBrick();

  const plan = selectedPlan();
  if (!checkoutConfig?.configured || !plan?.available) {
    setMessage("Mercado Pago ainda não configurado.", "error");
    return;
  }

  if (!window.MercadoPago) {
    setMessage("SDK do Mercado Pago indisponível.", "error");
    return;
  }

  paymentLoading.classList.remove("hidden");
  paymentLoading.textContent = "Carregando pagamento seguro...";
  setMessage("");

  try {
    const mp = new window.MercadoPago(checkoutConfig.publicKey, { locale: "pt-BR" });
    const bricks = mp.bricks({ theme: "dark" });

    paymentBrickController = await bricks.create("payment", "paymentBrick_container", {
      initialization: {
        amount: Number((plan.priceCents / 100).toFixed(2)),
        payer: {
          email: document.getElementById("buyerEmail").value || checkoutConfig.profile?.email || "",
        },
      },
      customization: {
        visual: {
          style: {
            theme: "dark",
            customVariables: {
              textPrimaryColor: "#eef7f3",
              textSecondaryColor: "#71857d",
              inputBackgroundColor: "#050a08",
              formBackgroundColor: "#08100e",
              baseColor: "#31e6ad",
              baseColorFirstVariant: "#11ba89",
              baseColorSecondVariant: "#10261e",
              outlinePrimaryColor: "#2bc999",
              outlineSecondaryColor: "#1a332a",
              buttonTextColor: "#03110c",
              borderRadiusSmall: "8px",
              borderRadiusMedium: "10px",
              borderRadiusLarge: "12px",
            },
          },
        },
        paymentMethods: {
          creditCard: "all",
          bankTransfer: "all",
          maxInstallments: 6,
        },
      },
      callbacks: {
        onReady: () => {
          paymentLoading.classList.add("hidden");
        },
        onSubmit: async ({ formData }) => {
          if (!validateBuyerFields()) {
            throw new Error("Preencha os dados do comprador e endereço antes de pagar.");
          }

          const activePlan = selectedPlan();
          if (!activePlan) throw new Error("Plano inválido.");

          setMessage("Processando pagamento...");
          const result = await api("/api/checkout/payment", {
            method: "POST",
            body: JSON.stringify({
              ...buyerPayload(),
              planKey: activePlan.key,
              idempotencyKey: paymentIntent,
              device_id: window.MP_DEVICE_SESSION_ID || undefined,
              formData,
            }),
          });

          paymentIntent = crypto.randomUUID();
          await handlePaymentResult(result);
        },
        onError: (error) => {
          console.error(error);
          setMessage(error?.message || "Não foi possível carregar o pagamento.", "error");
        },
      },
    });
  } catch (error) {
    paymentLoading.classList.add("hidden");
    setMessage(error.message || "Não foi possível carregar o Mercado Pago.", "error");
  }
}

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

document.getElementById("copyPixBtn").addEventListener("click", async () => {
  const input = document.getElementById("pixCode");
  await navigator.clipboard.writeText(input.value);
  const button = document.getElementById("copyPixBtn");
  button.textContent = "Copiado";
  setTimeout(() => { button.textContent = "Copiar código Pix"; }, 1200);
});

async function boot() {
  try {
    checkoutConfig = await api("/api/checkout/config");
    renderPlans();

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
      setMessage("Configure MP_PUBLIC_KEY, MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET e PUBLIC_URL para habilitar pagamentos.", "error");
      return;
    }

    await mountPaymentBrick();
  } catch (error) {
    setMessage(error.message, "error");
  }
}

boot();
