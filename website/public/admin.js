const loginBox = document.getElementById("loginBox");
const dashboard = document.getElementById("dashboard");
const loginError = document.getElementById("loginError");
const clientsBody = document.getElementById("clientsBody");
const clientsSummary = document.getElementById("clientsSummary");
const clientSearch = document.getElementById("clientSearch");
const releasesBody = document.getElementById("releasesBody");
let cachedClients = [];
let cachedReleases = [];

async function api(url, options = {}) {
  const response = await fetch(url, {
    headers: { "Content-Type": "application/json", ...(options.headers || {}) },
    ...options,
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(data.message || data.error || "Erro"), {
      status: response.status,
      data,
    });
  }
  return data;
}

async function checkAuth() {
  try {
    await api("/api/admin/me");
    loginBox.classList.add("hidden");
    dashboard.classList.remove("hidden");
    await Promise.all([loadStatus(), loadClients(), loadReleases()]);
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
      body: JSON.stringify({
        password: document.getElementById("password").value,
      }),
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
      <td><div class="client-cell"><strong>${escapeHtml(client.username)}</strong><small>${escapeHtml(client.email)}</small></div></td>
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
      await api(`/api/admin/clients/${button.dataset.id}/reset-hwid`, { method: "POST" });
      await loadClients();
    });
  });

  document.querySelectorAll(".toggle-ban").forEach((button) => {
    button.addEventListener("click", async () => {
      const banned = button.dataset.banned === "true";
      const action = banned ? "unban" : "ban";
      if (!confirm(banned ? "Desbanir este cliente?" : "Banir este cliente? Ele perderá acesso ao site e ao loader.")) return;
      await api(`/api/admin/clients/${button.dataset.id}/${action}`, { method: "POST" });
      await loadClients();
    });
  });
}

clientSearch?.addEventListener("input", renderClients);
document.getElementById("refreshClientsBtn")?.addEventListener("click", loadClients);

function formatBytes(bytes) {
  const value = Number(bytes || 0);
  if (value < 1024) return value + " B";
  if (value < 1024 * 1024) return (value / 1024).toFixed(1) + " KB";
  return (value / 1024 / 1024).toFixed(1) + " MB";
}

async function loadReleases() {
  const data = await api("/api/admin/releases");
  cachedReleases = data.releases || [];
  renderReleases();
}

function renderReleases() {
  releasesBody.innerHTML = "";
  const active = cachedReleases.find((release) => release.isActive);
  const latest = cachedReleases[0];
  const currentVersion = String(latest?.version || "").match(/^(\d+)\.(\d+)$/);
  const nextVersion = currentVersion
    ? currentVersion[1] + "." + (Number(currentVersion[2]) + 1)
    : "1.0";
  document.getElementById("nextReleaseVersion").textContent = "Próxima: v" + nextVersion;

  document.getElementById("currentReleaseVersion").textContent =
    active ? "v" + active.version : "Nenhuma publicada";
  document.getElementById("currentReleaseMeta").textContent =
    active
      ? `${active.fileName} · ${formatBytes(active.fileSize)} · ${new Date(active.uploadedAt).toLocaleString("pt-BR")}`
      : "Faça o primeiro upload para liberar o download aos clientes.";

  for (const release of cachedReleases) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>v${escapeHtml(release.version)}</strong></td>
      <td><div class="release-file-cell"><span>${escapeHtml(release.fileName)}</span><small>SHA-256 ${escapeHtml(release.sha256.slice(0, 12))}…</small></div></td>
      <td>${formatBytes(release.fileSize)}</td>
      <td>${new Date(release.uploadedAt).toLocaleString("pt-BR")}</td>
      <td><span class="tag ${release.isActive ? "ok" : "neutral"}">${release.isActive ? "Atual" : "Anterior"}</span></td>
      <td>
        <div class="client-actions">
          ${release.isActive ? "" : `<button class="button ghost small activate-release" data-id="${release.id}">Ativar</button>`}
          ${release.isActive ? "" : `<button class="button danger small delete-release" data-id="${release.id}">Excluir</button>`}
        </div>
      </td>
    `;
    releasesBody.appendChild(row);
  }

  document.querySelectorAll(".activate-release").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("Tornar esta versão a versão disponível para download?")) return;
      await api(`/api/admin/releases/${button.dataset.id}/activate`, { method: "POST" });
      await loadReleases();
    });
  });

  document.querySelectorAll(".delete-release").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!confirm("Excluir definitivamente esta versão antiga?")) return;
      await api(`/api/admin/releases/${button.dataset.id}`, { method: "DELETE" });
      await loadReleases();
    });
  });
}

document.getElementById("refreshReleasesBtn")?.addEventListener("click", loadReleases);

document.getElementById("releaseForm").addEventListener("submit", (event) => {
  event.preventDefault();

  const file = document.getElementById("releaseFile").files?.[0];
  const notes = document.getElementById("releaseNotes").value.trim();

  if (!file) {
    alert("Selecione o arquivo do loader.");
    return;
  }

  if (file.size > 100 * 1024 * 1024) {
    alert("O arquivo deve ter no máximo 100 MB.");
    return;
  }

  const state = document.getElementById("uploadState");
  const text = document.getElementById("uploadStateText");
  const percent = document.getElementById("uploadPercent");
  const bar = document.getElementById("uploadProgressBar");
  const button = document.getElementById("releaseUploadBtn");

  state.classList.remove("hidden");
  text.textContent = "Enviando " + file.name;
  percent.textContent = "0%";
  bar.style.width = "0%";
  button.disabled = true;

  const query = new URLSearchParams({
    notes,
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
  });

  const xhr = new XMLHttpRequest();
  xhr.open("POST", "/api/admin/releases/upload?" + query.toString());

  xhr.upload.addEventListener("progress", (e) => {
    if (!e.lengthComputable) return;
    const value = Math.round((e.loaded / e.total) * 100);
    percent.textContent = value + "%";
    bar.style.width = value + "%";
  });

  xhr.addEventListener("load", async () => {
    button.disabled = false;
    const data = (() => {
      try { return JSON.parse(xhr.responseText || "{}"); } catch { return {}; }
    })();

    if (xhr.status < 200 || xhr.status >= 300) {
      text.textContent = data.message || data.error || "Falha no upload.";
      state.classList.add("upload-error");
      return;
    }

    state.classList.remove("upload-error");
    text.textContent = "Versão publicada com sucesso.";
    percent.textContent = "100%";
    bar.style.width = "100%";
    document.getElementById("releaseFile").value = "";
    document.getElementById("releaseNotes").value = "";
    await loadReleases();
  });

  xhr.addEventListener("error", () => {
    button.disabled = false;
    text.textContent = "Falha de conexão durante o upload.";
    state.classList.add("upload-error");
  });

  xhr.send(file);
});

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  }[char]));
}

checkAuth();
