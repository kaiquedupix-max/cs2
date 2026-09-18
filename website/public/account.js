const authView = document.getElementById("authView");
const dashboardView = document.getElementById("dashboardView");
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const loginTab = document.getElementById("loginTab");
const registerTab = document.getElementById("registerTab");
const authError = document.getElementById("authError");

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
  history.replaceState(null, "", login ? "/account#login" : "/account#register");
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

document.getElementById("simulateBuyBtn").addEventListener("click", async () => {
  const button = document.getElementById("simulateBuyBtn");
  button.disabled = true;
  button.textContent = "Ativando...";
  try {
    const result = await api("/api/account/purchase-simulated", { method: "POST" });
    renderAccount(result.account);
    const notice = document.getElementById("purchaseNotice");
    notice.textContent = "Compra de teste concluída. O acesso de 30 dias já está disponível no loader.";
    notice.classList.remove("hidden");
  } catch (error) {
    alert(error.message);
  } finally {
    button.disabled = false;
    button.textContent = "Adicionar +30 dias de teste";
  }
});

function renderAccount(data) {
  authView.classList.add("hidden");
  dashboardView.classList.remove("hidden");

  const { user, product, status } = data;
  document.getElementById("helloUser").textContent = "Olá, " + user.username + ".";
  document.getElementById("profileUsername").textContent = user.username;
  document.getElementById("profileEmail").textContent = user.email;
  document.getElementById("memberSince").textContent = new Date(user.createdAt).toLocaleDateString("pt-BR");
  document.getElementById("planName").textContent = product.hasAccess ? product.plan : "Sem acesso";
  document.getElementById("daysRemaining").textContent = String(product.daysRemaining || 0);
  document.getElementById("expiresAt").textContent = product.expiresAt
    ? new Date(product.expiresAt).toLocaleString("pt-BR")
    : "—";
  document.getElementById("accountStatus").textContent =
    status.status === "online" ? "Online" :
    status.status === "maintenance" ? "Manutenção" : "Offline";

  const badge = document.getElementById("accessBadge");
  badge.textContent = product.hasAccess ? "ACESSO ATIVO" : "SEM ACESSO";
  badge.className = "access-badge " + (product.hasAccess ? "active" : "inactive");

  document.getElementById("productDescription").textContent = product.hasAccess
    ? `Seu plano está ativo e possui ${product.daysRemaining} dia(s) restante(s).`
    : "Ative a compra de teste para liberar o produto no loader.";

  document.getElementById("simulateBuyBtn").textContent = product.hasAccess
    ? "Adicionar +30 dias de teste"
    : "Ativar compra de teste";
}

async function boot() {
  if (location.hash === "#register") showTab("register");
  try {
    const data = await api("/api/account/me");
    renderAccount(data);
  } catch {
    authView.classList.remove("hidden");
    dashboardView.classList.add("hidden");
  }
}
boot();
