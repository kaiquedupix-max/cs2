const checkoutParams = new URLSearchParams(location.search);
const checkoutProduct = ({counterframe:"counterframe",combatarms:"combatarms"})[checkoutParams.get("product")] || "cs2";
const checkoutPlatform = checkoutProduct === "counterframe" && checkoutParams.get("platform") === "ios" ? "ios" :
  checkoutProduct === "counterframe" ? "android" : "windows";
const checkoutLang = ["pt","en","es","ru"].includes(checkoutParams.get("lang"))
  ? checkoutParams.get("lang") : (navigator.language || "pt").toLowerCase().split("-")[0];
const isCounterFrame = checkoutProduct === "counterframe";
let checkoutMarket = isCounterFrame ? "INTL" : "BR"; // Server config overrides it after IP geolocation.
const isIosPreorder = false;
const checkoutBox = document.getElementById("checkoutForm");
const message = document.getElementById("checkoutMessage");
const brickContainer = document.getElementById("paymentBrick_container");
const paymentLoading = document.getElementById("paymentLoading");
const pixResult = document.getElementById("pixResult");
const paymentApproved = document.getElementById("paymentApproved");
const stripeCheckoutButton=document.getElementById('stripeCheckoutButton');

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
let appliedCouponCode='';
let basePlanPrices=[];
let selectedPlanKey = checkoutParams.get("plan") || "d30";
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
    cpf: checkoutMarket==="BR"&&!isCounterFrame ? document.getElementById("buyerCpf").value : "",
    email: document.getElementById("buyerEmail").value,
    fingerprint: browserFingerprint(),
    product: checkoutProduct,
    platform: checkoutPlatform,
    market: checkoutMarket,
  };
}

function validateBuyerFields() {
  const required = [
    document.getElementById("buyerName"),
    ...((isCounterFrame||checkoutMarket==='INTL') ? [] : [document.getElementById("buyerCpf")]),
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
  if(cents == null || !Number.isFinite(Number(cents)))return "—";
  const loc = {pt:"pt-BR",en:"en-US",es:"es-ES",ru:"ru-RU"}[checkoutLang] || "en-US";
  return (Number(cents || 0) / 100).toLocaleString(loc, {
    style: "currency",
    currency: "BRL",
  });
}

function ct(key) { return window.lbCheckoutText?.(key) || key; }

function priceLabel(plan) {
  if(checkoutMarket === "INTL" && Number.isFinite(plan.usdPriceCents)) {
    return new Intl.NumberFormat(({pt:"pt-BR",en:"en-US",es:"es-ES",ru:"ru-RU"}[checkoutLang]||"en-US"),{style:"currency",currency:"USD"}).format(plan.usdPriceCents/100);
  }
  return money(plan.priceCents);
}
function selectedPlan() {
  return checkoutConfig?.plans?.find((plan) => plan.key === selectedPlanKey) || null;
}

function updatePlanSummary() {
  const plan = selectedPlan();
  if (!plan) return;

  document.getElementById("summaryPlan").textContent =
    plan.lifetime ? ct("lifetime") : String(plan.days) + " " + ct(plan.days === 1 ? "day" : "days");
  document.getElementById("summaryDays").textContent = plan.lifetime
    ? ct("lifetime")
    : plan.days + " " + ct(plan.days === 1 ? "day" : "days");
  document.getElementById("summaryPrice").textContent = priceLabel(plan);
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
  if(appliedCouponCode){checkoutConfig.plans=basePlanPrices.map(p=>({...p}));appliedCouponCode='';}
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
      <span>${plan.lifetime ? ct("lifetime") : plan.days + " " + ct(plan.days === 1 ? "day" : "days")}</span>
      <strong>${priceLabel(plan)}</strong>
      <small>${plan.lifetime ? ct("lifetime") : plan.days + " " + ct(plan.days === 1 ? "day" : "days")}</small>
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

async function showApproved(preOrder = isIosPreorder) {
  stopPaymentPolling();
  await destroyPaymentBrick();
  pixResult.classList.add("hidden");
  brickContainer.classList.add("hidden");
  stripeCheckoutButton.classList.add("hidden");
  paymentLoading.classList.add("hidden");
  paymentApproved.classList.remove("hidden");
  const loaderDownload=document.getElementById("approvedLoaderDownload");
  if(loaderDownload){loaderDownload.textContent=({pt:"Baixar loader Android",en:"Download Android loader",es:"Descargar loader Android",ru:"Скачать загрузчик для Android"})[checkoutLang];loaderDownload.classList.toggle("hidden",!(isCounterFrame&&checkoutPlatform==="android"));}
  if (preOrder) {
    paymentApproved.querySelector("strong").textContent = ct("preorderApproved");
    paymentApproved.querySelector("p").textContent = ct("preorderApprovedNote");
    setMessage(ct("preorderMessage"), "success");
  } else {
    paymentApproved.querySelector("strong").textContent = ct("approved");
    paymentApproved.querySelector("p").textContent = ct("approvedNote");
    setMessage(ct("approvedMessage"), "success");
  }
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
        await showApproved(Boolean(data.payment?.preOrder));
        return;
      }

      if (["declined", "canceled", "expired", "refund", "chargeback"].includes(status)) {
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
    await showApproved(Boolean(result.preOrder));
    return;
  }

  if(result.checkoutUrl){location.assign(result.checkoutUrl);return;}

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

  if(checkoutConfig?.provider==='stripe'){
    paymentLoading.classList.add('hidden');brickContainer.classList.add('hidden');stripeCheckoutButton.classList.remove('hidden');
    stripeCheckoutButton.textContent=({pt:'Pagar com Stripe',en:'Pay with Stripe',es:'Pagar con Stripe',ru:'Оплатить через Stripe'})[checkoutLang]||'Pay with Stripe';
    return;
  }
  stripeCheckoutButton.classList.add('hidden');brickContainer.classList.remove('hidden');

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
    const mpLocale = checkoutLang === "es" ? "es-AR" : checkoutLang === "pt" ? "pt-BR" : "en-US";
    const mp = new window.MercadoPago(checkoutConfig.publicKey, { locale: mpLocale });
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
          ...(checkoutLang === "pt" ? {bankTransfer: "all"} : {}),
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
              throw new Error(isCounterFrame
                ? "Informe nome e e-mail válidos antes de pagar."
                : "Preencha nome completo, CPF e e-mail antes de pagar.");
            }
            if (isIosPreorder && !document.getElementById("confirmIosPreorder")?.checked) {
              throw new Error(ct("iosConfirmError"));
            }

            await ensureCheckoutAccount();
            if(!document.getElementById('acceptPurchaseTerms')?.checked)throw Error(({pt:'Leia e aceite os termos antes de pagar.',en:'Read and accept the terms before paying.',es:'Lee y acepta los términos antes de pagar.',ru:'Перед оплатой прочитайте и примите условия.'})[checkoutLang]||'Read and accept the terms before paying.');

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
                couponCode: appliedCouponCode,
                referralCode: checkoutParams.get('ref')||localStorage.getItem('lb_referral')||'',
                termsAccepted: document.getElementById('acceptPurchaseTerms')?.checked===true,
                termsVersion: '2026-11-10.1',
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

stripeCheckoutButton.addEventListener('click',async()=>{
  stripeCheckoutButton.disabled=true;paymentLoading.classList.remove('hidden');paymentLoading.textContent=({pt:'Preparando checkout do Stripe…',en:'Preparing Stripe Checkout…',es:'Preparando el pago de Stripe…',ru:'Подготовка оплаты Stripe…'})[checkoutLang]||'Preparing Stripe Checkout…';
  try{
    if(!validateBuyerFields())throw new Error(({pt:'Informe nome e e-mail válidos.',en:'Enter a valid name and email.',es:'Introduce un nombre y correo válidos.',ru:'Укажите корректное имя и email.'})[checkoutLang]);
    await ensureCheckoutAccount();
    if(!document.getElementById('acceptPurchaseTerms')?.checked)throw Error(({pt:'Leia e aceite os termos antes de pagar.',en:'Read and accept the terms before paying.',es:'Lee y acepta los términos antes de pagar.',ru:'Перед оплатой прочитайте и примите условия.'})[checkoutLang]||'Read and accept the terms before paying.');
    const result=await api('/api/checkout/payment',{method:'POST',body:JSON.stringify({...buyerPayload(),planKey:selectedPlanKey,couponCode:appliedCouponCode,referralCode:checkoutParams.get('ref')||localStorage.getItem('lb_referral')||'',termsAccepted:true,termsVersion:'2026-11-10.1',idempotencyKey:paymentIntent,formData:{}})});
    if(!result.checkoutUrl)throw Error('Stripe checkout URL is missing.');location.assign(result.checkoutUrl);
  }catch(error){setMessage(error.message||'Could not start Stripe Checkout.','error');stripeCheckoutButton.disabled=false;paymentLoading.classList.add('hidden');}
});

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
    document.title = (isCounterFrame ? "Counter Flame" : checkoutProduct === "combatarms" ? "Combat Arms Brasil Server" : "CS2") + " | Legit Baratinho";
    document.getElementById("checkoutProductName").textContent =
      isCounterFrame ? "Counter Flame • " + (checkoutPlatform === "ios" ? "iOS" : "Android") : checkoutProduct === "combatarms" ? "Combat Arms Brasil Server" : "Counter-Strike 2";
    document.getElementById("checkoutProductIcon").textContent = isCounterFrame ? "CF" : checkoutProduct === "combatarms" ? "CA" : "CS";
    document.getElementById("iosCheckoutNotice")?.classList.toggle("hidden", !isIosPreorder);
    if (isCounterFrame) document.getElementById("buyerCpf").required = false;

    const checkoutQuery = new URLSearchParams({product: checkoutProduct});
    checkoutConfig = await api("/api/checkout/config?" + checkoutQuery);
    basePlanPrices=checkoutConfig.plans.map(p=>({...p}));
    checkoutMarket = checkoutConfig.market === "BR" ? "BR" : "INTL";
    const cpfLabel=document.getElementById('buyerCpfLabel');
    document.getElementById('buyerCpf').required=!isCounterFrame&&checkoutMarket==='BR';
    cpfLabel.classList.toggle('hidden',checkoutMarket==='INTL');
    document.querySelector('.checkout-security')?.classList.toggle('hidden',checkoutMarket==='INTL');
    document.getElementById('checkoutSecureNote')?.classList.add('hidden');
    if(checkoutMarket==='INTL'){
      const intro=document.getElementById("checkoutIntro");
      if(intro)intro.textContent=({pt:'Pague com cartão pelo Stripe.',en:'Pay by card with Stripe.',es:'Paga con tarjeta mediante Stripe.',ru:'Оплатите картой через Stripe.'})[checkoutLang];
      stripeCheckoutButton.textContent=({pt:'Pagar com Stripe',en:'Pay with Stripe',es:'Pagar con Stripe',ru:'Оплатить через Stripe'})[checkoutLang];
      document.getElementById('paymentLoading').textContent=({pt:'Carregando opções de pagamento…',en:'Loading payment options…',es:'Cargando opciones de pago…',ru:'Загрузка способов оплаты…'})[checkoutLang];
    }
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
      if(checkoutConfig.provider==='stripe'){
        brickContainer.classList.add('hidden');paymentLoading.classList.add('hidden');stripeCheckoutButton.classList.remove('hidden');stripeCheckoutButton.disabled=true;
        stripeCheckoutButton.textContent=({pt:'Pagar com Stripe',en:'Pay with Stripe',es:'Pagar con Stripe',ru:'Оплатить через Stripe'})[checkoutLang];
      }
      setMessage(checkoutMarket==='INTL'?({pt:'Pagamento indisponível no momento. Tente novamente mais tarde.',en:'Payment is unavailable right now. Please try again later.',es:'El pago no está disponible en este momento. Inténtalo más tarde.',ru:'Оплата сейчас недоступна. Попробуйте позже.'})[checkoutLang]:'Não foi possível carregar o pagamento. Tente novamente mais tarde.','error');
      return;
    }

    if(new URLSearchParams(location.search).get('stripe')==='cancelled')setMessage(({pt:'Pagamento cancelado. Você pode tentar novamente.',en:'Payment cancelled. You can try again.',es:'Pago cancelado. Puedes intentarlo otra vez.',ru:'Оплата отменена. Можно попробовать снова.'})[checkoutLang]);
    const returnedPayment=new URLSearchParams(location.search).get('payment_id'),stripeReturned=new URLSearchParams(location.search).get('stripe')==='success';
    if(returnedPayment&&stripeReturned)setMessage(({pt:'Aguardando confirmação segura do pagamento…',en:'Waiting for secure payment confirmation…',es:'Esperando la confirmación segura del pago…',ru:'Ожидаем безопасное подтверждение платежа…'})[checkoutLang]);
    await mountPaymentBrick();
    if(returnedPayment&&stripeReturned){stripeCheckoutButton.classList.add('hidden');startPaymentPolling(returnedPayment);}
  } catch (error) {
    setMessage(error.message, "error");
  }
}

boot();

