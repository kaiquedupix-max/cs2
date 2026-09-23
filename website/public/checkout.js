const checkoutBox = document.getElementById("checkoutForm");
const message = document.getElementById("checkoutMessage");
const brickContainer = document.getElementById("paymentBrick_container");
const paymentLoading = document.getElementById("paymentLoading");
const pixResult = document.getElementById("pixResult");
const paymentApproved = document.getElementById("paymentApproved");

const accountGuestBox = document.getElementById("checkoutAccountGuest");
const accountLoggedBox = document.getElementById("checkoutAccountLogged");
const accountLoggedText = document.getElementById("checkoutAccountLoggedText");
const accountCreateTab = document.getElementById("accountCreateTab");
const accountLoginTab = document.getElementById("accountLoginTab");
const accountCreateFields = document.getElementById("accountCreateFields");
const accountLoginFields = document.getElementById("accountLoginFields");
const checkoutUsername = document.getElementById("checkoutUsername");
const checkoutPassword = document.getElementById("checkoutPassword");
const checkoutLoginIdentifier = document.getElementById("checkoutLoginIdentifier");
const checkoutLoginPassword = document.getElementById("checkoutLoginPassword");

let checkoutConfig = null;
let selectedPlanKey = new URLSearchParams(location.search).get("plan") || "d30";
let paymentIntent = crypto.randomUUID();
let paymentBrickController = null;
let paymentPollTimer = null;
let accountAuthenticated = false;
let accountMode = "create";
let accountIdentity = null;
let usernameTouched = false;

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw Object.assign(
      new Error(data.message || data.error || "Não foi possível concluir."),
      { status: response.status, data }
    );
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
    fingerprint: browserFingerprint(),
  };
}

function validateBuyerFields() {
  const required = [
    document.getElementById("buyerName"),
    document.getElementById("buyerCpf"),
    document.getElementById("buyerEmail"),
  ];

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

function setAccountMode(mode) {
  accountMode = mode === "login" ? "login" : "create";

  accountCreateTab?.classList.toggle("active", accountMode === "create");
  accountLoginTab?.classList.toggle("active", accountMode === "login");
  accountCreateFields?.classList.toggle("hidden", accountMode !== "create");
  accountLoginFields?.classList.toggle("hidden", accountMode !== "login");

  setMessage("");
}

function renderAccountState() {
  if (accountAuthenticated) {
    accountGuestBox?.classList.add("hidden");
    accountLoggedBox?.classList.remove("hidden");

    if (accountLoggedText) {
      const label = accountIdentity?.username || accountIdentity?.email || "sua conta";
      accountLoggedText.textContent =
        "Conectado como " + label + ". A assinatura será vinculada automaticamente.";
    }
  } else {
    accountLoggedBox?.classList.add("hidden");
    accountGuestBox?.classList.remove("hidden");
    setAccountMode(accountMode);
  }
}

function suggestUsernameFromEmail() {
  if (!checkoutUsername || usernameTouched || checkoutUsername.value.trim()) return;

  const email = document.getElementById("buyerEmail").value.trim().toLowerCase();
  const local = email.split("@")[0] || "";
  let suggestion = local
    .replace(/[^a-z0-9_.-]/gi, "")
    .slice(0, 28);

  if (suggestion.length > 0 && suggestion.length < 3) {
    suggestion = (suggestion + "123").slice(0, 3);
  }

  if (suggestion.length >= 3) {
    checkoutUsername.value = suggestion;
  }
}

async function ensureCheckoutAccount() {
  if (accountAuthenticated) return true;

  if (accountMode === "login") {
    const identifier = checkoutLoginIdentifier?.value.trim() || "";
    const password = checkoutLoginPassword?.value || "";

    if (!identifier) {
      checkoutLoginIdentifier?.focus();
      throw new Error("Informe seu usuário ou e-mail para entrar.");
    }

    if (!password) {
      checkoutLoginPassword?.focus();
      throw new Error("Informe sua senha para entrar.");
    }

    setMessage("Entrando na sua conta...");

    const data = await api("/api/account/login", {
      method: "POST",
      body: JSON.stringify({ identifier, password }),
    });

    accountAuthenticated = true;
    accountIdentity = data.user || { email: identifier };
    checkoutLoginPassword.value = "";
    renderAccountState();
    return true;
  }

  const username = checkoutUsername?.value.trim() || "";
  const password = checkoutPassword?.value || "";
  const email = document.getElementById("buyerEmail").value.trim().toLowerCase();

  if (!/^[a-zA-Z0-9_.-]{3,28}$/.test(username)) {
    checkoutUsername?.focus();
    throw new Error("Crie um usuário de 3 a 28 caracteres usando letras, números, ponto, hífen ou underline.");
  }

  if (password.length < 8 || password.length > 128) {
    checkoutPassword?.focus();
    throw new Error("Crie uma senha com pelo menos 8 caracteres.");
  }

  setMessage("Criando sua conta...");

  try {
    const data = await api("/api/account/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password }),
    });

    accountAuthenticated = true;
    accountIdentity = data.user || { username, email };
    checkoutPassword.value = "";
    renderAccountState();
    return true;
  } catch (error) {
    if (error.status === 409) {
      setAccountMode("login");
      if (checkoutLoginIdentifier && !checkoutLoginIdentifier.value) {
        checkoutLoginIdentifier.value = email;
      }
      throw new Error("Este usuário ou e-mail já possui conta. Entre na sua conta para continuar a compra.");
    }
    throw error;
  }
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
  const fallback =
    plans.find((plan) => plan.key === "d30" && plan.available) ||
    plans.find((plan) => plan.available);

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
    try {
      await paymentBrickController.unmount();
    } catch {}
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

  setMessage("Pagamento confirmado. Sua assinatura já está ativa.", "success");
}

function startPaymentPolling(paymentId) {
  stopPaymentPolling();

  paymentPollTimer = setInterval(async () => {
    try {
      const data = await api("/api/checkout/payments/" + paymentId);
      const status = String(data.payment?.status || "").toLowerCase();

      if (status === "paid") {
        accountAuthenticated = true;
        accountIdentity = data.account?.user || accountIdentity;
        renderAccountState();
        await showApproved();
        return;
      }

      if (["declined", "canceled", "refund", "chargeback"].includes(status)) {
        stopPaymentPolling();
        setMessage("Pagamento não aprovado ou cancelado.", "error");
      }
    } catch {
      // O webhook ou uma consulta seguinte pode confirmar o pagamento.
    }
  }, 2500);
}

async function handlePaymentResult(result) {
  const status = String(result.status || "").toLowerCase();

  if (status === "paid") {
    accountAuthenticated = true;
    accountIdentity = result.account?.user || accountIdentity;
    renderAccountState();
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
    setMessage("Pix criado. Sua conta já está conectada; agora é só concluir o pagamento.");
    startPaymentPolling(result.paymentId);
    return;
  }

  if (status === "pending") {
    setMessage("Pagamento enviado. Sua conta já está conectada e estamos aguardando a confirmação do Mercado Pago.");
    startPaymentPolling(result.paymentId);
    return;
  }

  throw new Error(
    "Pagamento não aprovado. Status: " +
    (result.rawStatus || result.status || "recusado") +
    "."
  );
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
          try {
            if (!validateBuyerFields()) {
              throw new Error("Preencha nome completo, CPF e e-mail antes de pagar.");
            }

            await ensureCheckoutAccount();

            const activePlan = selectedPlan();
            if (!activePlan) {
              throw new Error("Plano inválido.");
            }

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
          } catch (error) {
            setMessage(error.message || "Não foi possível concluir a compra.", "error");
            throw error;
          }
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

document.getElementById("buyerEmail").addEventListener("input", () => {
  suggestUsernameFromEmail();
});

checkoutUsername?.addEventListener("input", () => {
  usernameTouched = true;
});

accountCreateTab?.addEventListener("click", () => {
  setAccountMode("create");
});

accountLoginTab?.addEventListener("click", () => {
  setAccountMode("login");

  if (checkoutLoginIdentifier && !checkoutLoginIdentifier.value) {
    checkoutLoginIdentifier.value = document.getElementById("buyerEmail").value.trim();
  }
});

document.getElementById("copyPixBtn").addEventListener("click", async () => {
  const input = document.getElementById("pixCode");
  await navigator.clipboard.writeText(input.value);

  const button = document.getElementById("copyPixBtn");
  button.textContent = "Copiado";

  setTimeout(() => {
    button.textContent = "Copiar código Pix";
  }, 1200);
});

async function boot() {
  try {
    checkoutConfig = await api("/api/checkout/config");
    renderPlans();

    const profile = checkoutConfig.profile || {};

    document.getElementById("buyerName").value = profile.fullName || "";
    document.getElementById("buyerCpf").value = profile.cpf || "";
    document.getElementById("buyerEmail").value = profile.email || "";

    accountAuthenticated = Boolean(checkoutConfig.authenticated);
    accountIdentity = checkoutConfig.account || null;
    renderAccountState();
    suggestUsernameFromEmail();

    if (!checkoutConfig.configured) {
      setMessage(
        "Configure MP_PUBLIC_KEY, MP_ACCESS_TOKEN, MP_WEBHOOK_SECRET e PUBLIC_URL para habilitar pagamentos.",
        "error"
      );
      return;
    }

    await mountPaymentBrick();
  } catch (error) {
    setMessage(error.message, "error");
  }
}

boot();
