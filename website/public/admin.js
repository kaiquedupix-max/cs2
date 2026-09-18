const loginBox = document.getElementById("loginBox");
const dashboard = document.getElementById("dashboard");
const loginError = document.getElementById("loginError");
const licensesBody = document.getElementById("licensesBody");
const newKeyBox = document.getElementById("newKeyBox");

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(data.message || data.error || "Erro"), { status: response.status, data });
  return data;
}

async function checkAuth() {
  try {
    await api("/api/admin/me");
    loginBox.classList.add("hidden");
    dashboard.classList.remove("hidden");
    await Promise.all([loadLicenses(), loadStatus()]);
  } catch {
    loginBox.classList.remove("hidden");
    dashboard.classList.add("hidden");
  }
}

document.getElementById("loginForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  loginError.textContent = "";
  try {
    await api("/api/admin/login", {
      method: "POST",
      body: JSON.stringify({ password: document.getElementById("password").value }),
    });
    document.getElementById("password").value = "";
    await checkAuth();
  } catch (error) {
    loginError.textContent = error.message;
  }
});

document.getElementById("logoutBtn").addEventListener("click", async () => {
  await api("/api/admin/logout", { method: "POST" });
  await checkAuth();
});

async function loadStatus() {
  const data = await api("/api/status");
  document.getElementById("statusSelect").value = data.status;
  document.getElementById("statusMessage").value = data.message || "";
}

document.getElementById("statusForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  await api("/api/admin/status", {
    method: "POST",
    body: JSON.stringify({
      status: document.getElementById("statusSelect").value,
      message: document.getElementById("statusMessage").value,
    }),
  });
  await loadStatus();
});

document.getElementById("keyForm").addEventListener("submit", async (event) => {
  event.preventDefault();
  const data = await api("/api/admin/licenses", {
    method: "POST",
    body: JSON.stringify({
      plan: document.getElementById("plan").value,
      days: Number(document.getElementById("days").value),
      note: document.getElementById("note").value,
    }),
  });
  newKeyBox.textContent = "NOVA KEY: " + data.key;
  newKeyBox.classList.remove("hidden");
  await loadLicenses();
});

async function loadLicenses() {
  const data = await api("/api/admin/licenses");
  licensesBody.innerHTML = "";
  for (const license of data.licenses) {
    const active = !license.revoked_at && (!license.expires_at || new Date(license.expires_at) > new Date());
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${license.id}</td>
      <td><code>${escapeHtml(license.key_prefix)}</code></td>
      <td>${escapeHtml(license.plan)}</td>
      <td>${license.expires_at ? new Date(license.expires_at).toLocaleDateString("pt-BR") : "Sem expiração"}</td>
      <td>${escapeHtml(license.note || "—")}</td>
      <td><span class="tag ${active ? "ok" : "bad"}">${active ? "Ativa" : "Inativa"}</span></td>
      <td>${license.revoked_at ? "" : `<button class="button ghost small revoke" data-id="${license.id}">Revogar</button>`}</td>
    `;
    licensesBody.appendChild(row);
  }

  document.querySelectorAll(".revoke").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("Revogar esta licença?")) return;
      await api(`/api/admin/licenses/${button.dataset.id}/revoke`, { method: "POST" });
      await loadLicenses();
    });
  });
}

document.getElementById("refreshBtn").addEventListener("click", loadLicenses);

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char]));
}

checkAuth();