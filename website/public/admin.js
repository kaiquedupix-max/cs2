const loginBox = document.getElementById("loginBox");
const dashboard = document.getElementById("dashboard");
const loginError = document.getElementById("loginError");
const licensesBody = document.getElementById("licensesBody");
const newKeyBox = document.getElementById("newKeyBox");
const clientsBody = document.getElementById("clientsBody");
const clientsSummary = document.getElementById("clientsSummary");
const clientSearch = document.getElementById("clientSearch");
let cachedClients = [];

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
    await Promise.all([loadLicenses(), loadStatus(), loadClients()]);
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

async function loadClients() {
  const data = await api("/api/admin/clients");
  cachedClients = data.clients || [];
  renderClients();
}

function renderClients() {
  const query = (clientSearch?.value || "").trim().toLowerCase();
  const clients = cachedClients.filter((client) =>
    !query ||
    client.username.toLowerCase().includes(query) ||
    client.email.toLowerCase().includes(query)
  );

  clientsSummary.textContent = `${clients.length} cliente(s)`;
  clientsBody.innerHTML = "";

  for (const client of clients) {
    const row = document.createElement("tr");
    const hwid = client.hwidBound
      ? '<span class="tag ok">Vinculado</span>'
      : '<span class="tag neutral">Livre</span>';
    const status = client.banned
      ? '<span class="tag bad">Banido</span>'
      : '<span class="tag ok">Ativo</span>';

    row.innerHTML = `
      <td>
        <div class="client-cell">
          <strong>${escapeHtml(client.username)}</strong>
          <small>${escapeHtml(client.email)}</small>
        </div>
      </td>
      <td>${escapeHtml(client.plan || "Sem acesso")}</td>
      <td><strong>${client.daysRemaining || 0}</strong></td>
      <td>${hwid}</td>
      <td>${status}</td>
      <td>
        <div class="client-actions">
          <button class="button ghost small add-days" data-id="${client.id}" data-user="${escapeHtml(client.username)}">+ Dias</button>
          <button class="button ghost small reset-hwid" data-id="${client.id}" ${client.hwidBound ? "" : "disabled"}>Reset HWID</button>
          <button class="button ${client.banned ? "primary" : "danger"} small toggle-ban" data-id="${client.id}" data-banned="${client.banned}">
            ${client.banned ? "Desbanir" : "Banir"}
          </button>
        </div>
      </td>
    `;
    clientsBody.appendChild(row);
  }

  document.querySelectorAll(".add-days").forEach((button) => {
    button.addEventListener("click", async () => {
      const amount = prompt(`Quantos dias adicionar para ${button.dataset.user}?`, "30");
      if (amount === null) return;

      const days = Number(amount);
      if (!Number.isInteger(days) || days < 1 || days > 3650) {
        alert("Informe um número entre 1 e 3650.");
        return;
      }

      await api(`/api/admin/clients/${button.dataset.id}/add-days`, {
        method: "POST",
        body: JSON.stringify({ days, plan: "admin" }),
      });

      await loadClients();
    });
  });

  document.querySelectorAll(".reset-hwid").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("Resetar o HWID deste cliente? O próximo computador que fizer login será vinculado.")) return;

      await api(`/api/admin/clients/${button.dataset.id}/reset-hwid`, {
        method: "POST",
      });

      await loadClients();
    });
  });

  document.querySelectorAll(".toggle-ban").forEach((button) => {
    button.addEventListener("click", async () => {
      const banned = button.dataset.banned === "true";
      const action = banned ? "unban" : "ban";
      const message = banned
        ? "Desbanir este cliente?"
        : "Banir este cliente? Ele perderá acesso ao site e ao loader.";

      if (!confirm(message)) return;

      await api(`/api/admin/clients/${button.dataset.id}/${action}`, {
        method: "POST",
      });

      await loadClients();
    });
  });
}

document.getElementById("refreshClientsBtn")?.addEventListener("click", loadClients);
clientSearch?.addEventListener("input", renderClients);

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