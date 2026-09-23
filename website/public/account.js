const authView = document.getElementById("authView");
const dashboardView = document.getElementById("dashboardView");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");
const authError = document.getElementById("authError");
const freeTrialBtn = document.getElementById("freeTrialBtn");
const freeTrialHint = document.getElementById("freeTrialHint");
const purchaseNotice = document.getElementById("purchaseNotice");
const wantsTrial = new URLSearchParams(location.search).get("trial") === "1";

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.message || data.error || "Não foi possível concluir.");
  }
  return data;
}

function showTab(tab) {
  const login = tab === "login";
  loginForm.classList.toggle("hidden", !login);
  registerForm.classList.toggle("hidden", login);
  loginTab.classList.toggle("active", login);
  registerTab.classList.toggle("active", !login);
  authError.textContent = "";
  const url = new URL(location.href);
  url.hash = login ? "#login" : "#register";
  history.replaceState(null, "", url.pathname + url.search + url.hash);
}

loginTab.addEventListener("click", () => showTab("login"));
registerTab.addEventListener("click", () => showTab("register"));

loginForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authError.textContent = "";
  try {
    const data = await api("/api/account/login", {
      method: "POST",
      body: JSON.stringify({
        identifier: document.getElementById("loginIdentifier").value,
        password: document.getElementById("loginPassword").value,
      }),
    });
    renderAccount(data);
  } catch (error) {
    authError.textContent = error.message;
  }
});

registerForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  authError.textContent = "";
  try {
    const data = await api("/api/account/register", {
      method: "POST",
      body: JSON.stringify({
        username: document.getElementById("registerUsername").value,
        email: document.getElementById("registerEmail").value,
        password: document.getElementById("registerPassword").value,
      }),
    });
    renderAccount(data);
  } catch (error) {
    authError.textContent = error.message;
  }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await api("/api/account/logout", { method: "POST" });
  dashboardView.classList.add("hidden");
  authView.classList.remove("hidden");
  showTab("login");
});

function renderAccount(data) {
  authView.classList.add("hidden");
  dashboardView.classList.remove("hidden");

  const { user, product, status } = data;
  document.getElementById("helloUser").textContent = "Olá, " + user.username + ".";
  document.getElementById("profileUsername").textContent = user.username;
  document.getElementById("profileEmail").textContent = user.email;
  document.getElementById("memberSince").textContent = new Date(user.createdAt).toLocaleDateString("pt-BR");
  document.getElementById("planName").textContent = product.hasAccess
    ? (product.planLabel || (product.isFreeTrial ? "Teste grátis" : product.plan) || "Ativo")
    : "Sem acesso";
  document.getElementById("daysRemaining").textContent = product.lifetime
    ? "∞"
    : String(product.daysRemaining || 0);
  document.getElementById("expiresAt").textContent = product.lifetime
    ? "Lifetime"
    : product.expiresAt
      ? new Date(product.expiresAt).toLocaleString("pt-BR")
      : "—";
  document.getElementById("accountStatus").textContent =
    status.status === "online" ? "Online" :
    status.status === "maintenance" ? "Manutenção" : "Offline";

  const badge = document.getElementById("accessBadge");
  badge.textContent = product.hasAccess ? "ACESSO ATIVO" : "SEM ACESSO";
  badge.className = "access-badge " + (product.hasAccess ? "active" : "inactive");

  document.getElementById("productDescription").textContent = product.hasAccess
    ? product.lifetime
      ? "Seu plano Lifetime está ativo. Seu acesso não expira."
      : product.isFreeTrial
        ? "Seu teste grátis está ativo por 1 dia. O primeiro PC usado no loader ficará vinculado a este teste."
        : `Seu plano está ativo e possui ${product.daysRemaining} dia(s) restante(s).`
    : "Ative o teste grátis de 1 dia ou compre um plano para liberar o produto no loader.";

  const trial = data.trial || {};
  freeTrialBtn?.classList.toggle("hidden", !trial.eligible || product.hasAccess);

  if (freeTrialHint) {
    freeTrialHint.textContent = product.isFreeTrial
      ? "Teste grátis ativo. Ele fica vinculado ao primeiro PC usado no loader."
      : trial.claimed
        ? "Teste grátis já utilizado nesta conta."
        : "1 teste grátis de 1 dia por conta e por PC.";
  }

  const buyButton = document.getElementById("buyAccessBtn");
  buyButton.textContent = product.hasAccess ? "Comprar / renovar plano" : "Comprar acesso";

  if (wantsTrial && trial.eligible && freeTrialBtn) {
    freeTrialBtn.classList.add("trial-attention");
  }

  loadRelease(product.hasAccess);
}

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024) return value + " B";
  if (value < 1024 * 1024) return (value / 1024).toFixed(1) + " KB";
  return (value / 1024 / 1024).toFixed(1) + " MB";
}

async function loadRelease(hasAccess) {
  const button = document.getElementById("downloadLoaderBtn");
  const description = document.getElementById("downloadDescription");
  const version = document.getElementById("downloadVersion");
  const size = document.getElementById("downloadSize");
  const date = document.getElementById("downloadDate");
  const hash = document.getElementById("downloadHash");

  button.classList.add("disabled");
  button.setAttribute("aria-disabled", "true");
  button.href = "#";
  version.textContent = "—";
  size.textContent = "—";
  date.textContent = "—";
  hash.textContent = "SHA-256 —";

  if (!hasAccess) {
    description.textContent = "Tenha um acesso ativo para liberar o download da versão mais recente.";
    return;
  }

  description.textContent = "Consultando a versão mais recente...";

  try {
    const data = await api("/api/account/release");
    const release = data.release;

    version.textContent = "v" + release.version;
    size.textContent = formatBytes(release.fileSize);
    date.textContent = new Date(release.uploadedAt).toLocaleString("pt-BR");
    hash.textContent = "SHA-256 " + release.sha256.slice(0, 16) + "…";
    description.textContent = release.notes || "Versão mais recente disponível para sua conta.";

    button.href = release.downloadUrl;
    button.classList.remove("disabled");
    button.removeAttribute("aria-disabled");
  } catch (error) {
    description.textContent = error.message || "Nenhuma versão disponível no momento.";
  }
}

freeTrialBtn?.addEventListener("click", async () => {
  const confirmed = confirm(
    "Ativar agora o teste grátis de 1 dia? As 24 horas começam imediatamente e o teste ficará vinculado ao primeiro PC usado no loader."
  );

  if (!confirmed) return;

  freeTrialBtn.disabled = true;
  freeTrialBtn.textContent = "Ativando...";

  try {
    const result = await api("/api/account/free-trial", { method: "POST" });
    renderAccount(result.account);

    if (purchaseNotice) {
      purchaseNotice.textContent = "Teste grátis ativado por 1 dia. Abra o loader e entre com esta mesma conta.";
      purchaseNotice.classList.remove("hidden");
    }
  } catch (error) {
    if (purchaseNotice) {
      purchaseNotice.textContent = error.message;
      purchaseNotice.classList.remove("hidden");
    } else {
      alert(error.message);
    }
  } finally {
    freeTrialBtn.disabled = false;
    freeTrialBtn.textContent = "Testar grátis por 1 dia";
  }
});

document.getElementById("downloadLoaderBtn")?.addEventListener("click", (event) => {
  const button = event.currentTarget;
  if (button.classList.contains("disabled")) {
    event.preventDefault();
  }
});

async function boot() {
  if (location.hash === "#register" || wantsTrial) showTab("register");
  try {
    const data = await api("/api/account/me");
    renderAccount(data);
  } catch {
    authView.classList.remove("hidden");
    dashboardView.classList.add("hidden");
  }
}
boot();
