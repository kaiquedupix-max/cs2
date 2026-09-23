const loginBox = document.getElementById("loginBox");
const dashboard = document.getElementById("dashboard");
const loginError = document.getElementById("loginError");
const clientsBody = document.getElementById("clientsBody");
const clientsSummary = document.getElementById("clientsSummary");
const clientSearch = document.getElementById("clientSearch");
const releasesBody = document.getElementById("releasesBody");
let cachedClients = [];
let cachedReleases = [];
let cachedSupportConversations = [];
let activeSupportConversationId = null;
let supportPollTimer = null;
let supportPollBusy = false;
let supportUnreadSnapshot = null;
let supportAudioContext = null;
let supportAdminSoundEnabled = localStorage.getItem("lb_admin_support_sound") !== "off";

const supportConversationList = document.getElementById("supportConversationList");
const supportUnreadTotal = document.getElementById("supportUnreadTotal");
const supportChatEmpty = document.getElementById("supportChatEmpty");
const supportChatActive = document.getElementById("supportChatActive");
const supportAdminMessages = document.getElementById("supportAdminMessages");
const supportChatTitle = document.getElementById("supportChatTitle");
const toggleSupportStatusBtn = document.getElementById("toggleSupportStatusBtn");
const supportContactActions = document.getElementById("supportContactActions");
const supportContactEmail = document.getElementById("supportContactEmail");
const supportContactWhatsapp = document.getElementById("supportContactWhatsapp");
const supportAdminSoundBtn = document.getElementById("supportAdminSoundBtn");

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
    await Promise.all([loadStatus(), loadClients(), loadReleases(), loadSupportConversations()]);
    startSupportPolling();
  } catch {
    stopSupportPolling();
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


function ensureSupportAdminAudio() {
  if (!supportAdminSoundEnabled) return null;

  try {
    if (!supportAudioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      supportAudioContext = new AudioContextClass();
    }

    if (supportAudioContext.state === "suspended") {
      supportAudioContext.resume().catch(() => {});
    }

    return supportAudioContext;
  } catch {
    return null;
  }
}

function supportAdminTone(frequency, duration, gainValue, delay = 0) {
  const ctx = ensureSupportAdminAudio();
  if (!ctx) return;

  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  const start = ctx.currentTime + delay;

  oscillator.type = "sine";
  oscillator.frequency.setValueAtTime(frequency, start);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(gainValue, start + 0.012);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);

  oscillator.connect(gain);
  gain.connect(ctx.destination);
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function playSupportAdminSound(kind) {
  if (!supportAdminSoundEnabled) return;

  if (kind === "receive") {
    supportAdminTone(760, 0.12, 0.06);
    supportAdminTone(980, 0.15, 0.05, 0.11);
    return;
  }

  supportAdminTone(560, 0.07, 0.04);
}

function updateSupportAdminSoundButton() {
  if (!supportAdminSoundBtn) return;
  supportAdminSoundBtn.textContent = supportAdminSoundEnabled ? "🔊 Sons" : "🔇 Sons";
  supportAdminSoundBtn.title = supportAdminSoundEnabled
    ? "Desativar sons do suporte"
    : "Ativar sons do suporte";
}

supportAdminSoundBtn?.addEventListener("click", () => {
  supportAdminSoundEnabled = !supportAdminSoundEnabled;
  localStorage.setItem("lb_admin_support_sound", supportAdminSoundEnabled ? "on" : "off");
  updateSupportAdminSoundButton();

  if (supportAdminSoundEnabled) {
    ensureSupportAdminAudio();
    playSupportAdminSound("send");
  }
});

document.addEventListener(
  "pointerdown",
  () => {
    if (supportAdminSoundEnabled) ensureSupportAdminAudio();
  },
  { once: true }
);

updateSupportAdminSoundButton();

async function loadSupportConversations() {
  if (!supportConversationList) return;

  const data = await api("/api/admin/support/conversations");
  const nextConversations = data.conversations || [];
  const nextUnread = nextConversations.reduce(
    (total, item) => total + Number(item.unread || 0),
    0
  );

  if (supportUnreadSnapshot !== null && nextUnread > supportUnreadSnapshot) {
    playSupportAdminSound("receive");
  }

  supportUnreadSnapshot = nextUnread;
  cachedSupportConversations = nextConversations;
  renderSupportConversations();

  if (
    activeSupportConversationId &&
    !cachedSupportConversations.some((item) => item.id === activeSupportConversationId)
  ) {
    activeSupportConversationId = null;
    supportChatActive?.classList.add("hidden");
    supportChatEmpty?.classList.remove("hidden");
  }
}

function renderSupportConversations() {
  if (!supportConversationList) return;

  const unread = cachedSupportConversations.reduce(
    (total, item) => total + Number(item.unread || 0),
    0
  );

  if (supportUnreadTotal) {
    supportUnreadTotal.textContent = unread
      ? `${unread} pendente(s)`
      : "Tudo respondido";
  }

  supportConversationList.innerHTML = "";

  if (!cachedSupportConversations.length) {
    supportConversationList.innerHTML =
      '<div class="admin-support-no-conversations">Nenhuma conversa ainda.</div>';
    return;
  }

  for (const conversation of cachedSupportConversations) {
    const button = document.createElement("button");
    button.type = "button";
    button.className =
      "support-conversation-item" +
      (conversation.id === activeSupportConversationId ? " active" : "") +
      (conversation.unread ? " unread" : "");

    const date = conversation.lastMessageAt
      ? new Date(conversation.lastMessageAt).toLocaleString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          hour: "2-digit",
          minute: "2-digit",
        })
      : "";

    button.innerHTML = `
      <div class="support-conversation-top">
        <strong>Visitante #${conversation.id}</strong>
        <span>${escapeHtml(date)}</span>
      </div>
      <p>${escapeHtml(conversation.lastMessage || "Conversa iniciada")}</p>
      <small class="support-conversation-contact">${escapeHtml(conversation.email || (conversation.whatsapp ? "+" + conversation.whatsapp : "Contato não informado"))}</small>
      <div class="support-conversation-bottom">
        <span class="tag ${conversation.status === "closed" ? "neutral" : "ok"}">
          ${conversation.status === "closed" ? "Encerrada" : "Aberta"}
        </span>
        ${conversation.unread ? `<b>${conversation.unread}</b>` : ""}
      </div>
    `;

    button.addEventListener("click", () => openSupportConversation(conversation.id));
    supportConversationList.appendChild(button);
  }
}

async function openSupportConversation(id) {
  activeSupportConversationId = Number(id);
  renderSupportConversations();

  supportChatEmpty?.classList.add("hidden");
  supportChatActive?.classList.remove("hidden");

  if (supportChatTitle) {
    supportChatTitle.textContent = "Visitante #" + activeSupportConversationId;
  }

  supportContactActions?.classList.add("hidden");
  await loadSupportMessages();
}

async function loadSupportMessages() {
  if (!activeSupportConversationId || !supportAdminMessages) return;

  const data = await api(
    `/api/admin/support/conversations/${activeSupportConversationId}/messages`
  );

  const contact = data.conversation?.contact || {};
  const email = String(contact.email || "");
  const whatsapp = String(contact.whatsapp || "").replace(/\D/g, "");

  if (supportChatTitle) {
    supportChatTitle.textContent = email || ("Visitante #" + activeSupportConversationId);
  }

  if (supportContactEmail) {
    supportContactEmail.href = email ? "mailto:" + email : "#";
    supportContactEmail.textContent = email ? "✉ " + email : "✉ E-mail não informado";
    supportContactEmail.classList.toggle("disabled", !email);
  }

  if (supportContactWhatsapp) {
    supportContactWhatsapp.href = whatsapp ? "https://wa.me/" + whatsapp : "#";
    supportContactWhatsapp.textContent = whatsapp ? "◉ WhatsApp +" + whatsapp : "◉ WhatsApp não informado";
    supportContactWhatsapp.classList.toggle("disabled", !whatsapp);
  }

  supportContactActions?.classList.toggle("hidden", !email && !whatsapp);

  supportAdminMessages.innerHTML = "";

  for (const message of data.messages || []) {
    const bubble = document.createElement("div");
    bubble.className =
      "admin-support-message " + (message.sender === "admin" ? "admin" : "visitor");

    const body = document.createElement("p");
    body.textContent = message.body;

    const meta = document.createElement("small");
    meta.textContent =
      (message.sender === "admin" ? "Você" : "Visitante") +
      " • " +
      new Date(message.createdAt).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      }) +
      (message.sender === "admin" ? (message.readAt ? " ✓✓" : " ✓") : "");

    if (message.sender === "admin" && message.readAt) {
      meta.classList.add("read");
    }

    bubble.append(body, meta);
    supportAdminMessages.appendChild(bubble);
  }

  supportAdminMessages.scrollTop = supportAdminMessages.scrollHeight;

  const active = cachedSupportConversations.find(
    (item) => item.id === activeSupportConversationId
  );

  if (active) {
    active.unread = 0;
    active.status = data.conversation?.status || active.status;
  }

  if (toggleSupportStatusBtn) {
    const closed = data.conversation?.status === "closed";
    toggleSupportStatusBtn.textContent = closed ? "Reabrir" : "Encerrar";
    toggleSupportStatusBtn.dataset.status = closed ? "closed" : "open";
  }

  renderSupportConversations();
}

document.getElementById("supportReplyForm")?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const input = document.getElementById("supportReplyInput");
  const message = input?.value.trim();
  if (!activeSupportConversationId || !message) return;

  const button = event.currentTarget.querySelector("button[type='submit']");
  if (button) button.disabled = true;

  try {
    await api(
      `/api/admin/support/conversations/${activeSupportConversationId}/messages`,
      {
        method: "POST",
        body: JSON.stringify({ message }),
      }
    );

    input.value = "";
    playSupportAdminSound("send");
    await Promise.all([loadSupportMessages(), loadSupportConversations()]);
  } finally {
    if (button) button.disabled = false;
    input?.focus();
  }
});

toggleSupportStatusBtn?.addEventListener("click", async () => {
  if (!activeSupportConversationId) return;

  const current = toggleSupportStatusBtn.dataset.status || "open";
  const status = current === "closed" ? "open" : "closed";

  await api(
    `/api/admin/support/conversations/${activeSupportConversationId}/status`,
    {
      method: "POST",
      body: JSON.stringify({ status }),
    }
  );

  await Promise.all([loadSupportConversations(), loadSupportMessages()]);
});

document.getElementById("refreshSupportBtn")?.addEventListener("click", async () => {
  await loadSupportConversations();
  if (activeSupportConversationId) await loadSupportMessages();
});

function startSupportPolling() {
  stopSupportPolling();

  supportPollTimer = setInterval(async () => {
    if (dashboard.classList.contains("hidden") || supportPollBusy) return;

    supportPollBusy = true;
    try {
      await loadSupportConversations();
      if (activeSupportConversationId) {
        await loadSupportMessages();
      }
    } catch {
      // Mantém o painel utilizável mesmo se uma atualização do chat falhar.
    } finally {
      supportPollBusy = false;
    }
  }, 4000);
}

function stopSupportPolling() {
  if (supportPollTimer) clearInterval(supportPollTimer);
  supportPollTimer = null;
}

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
    alert("Selecione o executável .exe do loader.");
    return;
  }

  if (!file.name.toLowerCase().endsWith(".exe")) {
    alert("Envie o executável single-file .exe gerado pelo publish.");
    return;
  }

  if (file.size > 250 * 1024 * 1024) {
    alert("O arquivo deve ter no máximo 250 MB.");
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
