(() => {
  if (document.querySelector("[data-support-widget]")) return;

  const root = document.createElement("div");
  root.className = "support-widget";
  root.dataset.supportWidget = "1";
  root.innerHTML = `
    <button class="support-fab" type="button" aria-label="Abrir suporte">
      <span class="support-fab-dot"></span>
      <span class="support-fab-icon">💬</span>
    </button>

    <section class="support-panel" aria-hidden="true">
      <header class="support-panel-head">
        <div>
          <small>SUPORTE DIRETO</small>
          <strong>Fale com a gente</strong>
          <span><i></i> Atendimento pelo painel</span>
        </div>
        <button class="support-close" type="button" aria-label="Fechar">×</button>
      </header>

      <div class="support-intro">
        <strong>Tem alguma dúvida?</strong>
        <p>Mande sua mensagem aqui. Sua conversa fica salva e a resposta aparece neste mesmo chat.</p>
      </div>

      <div class="support-messages" role="log" aria-live="polite"></div>

      <form class="support-form">
        <textarea maxlength="1200" rows="1" placeholder="Digite sua dúvida..." required></textarea>
        <button type="submit" aria-label="Enviar mensagem">➤</button>
      </form>

      <div class="support-footer-status">Suporte brasileiro • resposta pelo site</div>
    </section>
  `;

  document.body.appendChild(root);

  const fab = root.querySelector(".support-fab");
  const panel = root.querySelector(".support-panel");
  const close = root.querySelector(".support-close");
  const messagesBox = root.querySelector(".support-messages");
  const form = root.querySelector(".support-form");
  const textarea = form.querySelector("textarea");
  const intro = root.querySelector(".support-intro");

  let open = false;
  let loading = false;
  let pollTimer = null;
  let lastSignature = "";

  function setOpen(value) {
    open = Boolean(value);
    panel.classList.toggle("open", open);
    panel.setAttribute("aria-hidden", open ? "false" : "true");
    fab.classList.toggle("hidden", open);

    if (open) {
      refreshMessages(true);
      textarea.focus();
      startPolling();
    } else {
      stopPolling();
    }
  }

  function startPolling() {
    stopPolling();
    pollTimer = setInterval(() => {
      if (open) refreshMessages(false);
    }, 4000);
  }

  function stopPolling() {
    if (pollTimer) clearInterval(pollTimer);
    pollTimer = null;
  }

  async function api(url, options = {}) {
    const response = await fetch(url, {
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
      ...options,
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.message || data.error || "Não foi possível falar com o suporte.");
    }
    return data;
  }

  function timeLabel(value) {
    try {
      return new Date(value).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
      });
    } catch {
      return "";
    }
  }

  function renderMessages(messages) {
    const signature = JSON.stringify((messages || []).map((item) => [item.id, item.sender, item.body]));
    if (signature === lastSignature) return;
    lastSignature = signature;

    messagesBox.innerHTML = "";

    if (!messages?.length) {
      messagesBox.innerHTML = '<div class="support-empty">Envie a primeira mensagem e fale diretamente com o suporte.</div>';
      intro.classList.remove("hidden");
      return;
    }

    intro.classList.add("hidden");

    for (const message of messages) {
      const bubble = document.createElement("div");
      bubble.className = "support-message " + (message.sender === "admin" ? "admin" : "visitor");

      const body = document.createElement("p");
      body.textContent = message.body;

      const meta = document.createElement("small");
      meta.textContent = (message.sender === "admin" ? "Suporte" : "Você") + " • " + timeLabel(message.createdAt);

      bubble.append(body, meta);
      messagesBox.appendChild(bubble);
    }

    messagesBox.scrollTop = messagesBox.scrollHeight;
  }

  async function refreshMessages(force = false) {
    if (loading && !force) return;
    loading = true;
    try {
      const data = await api("/api/support/messages");
      renderMessages(data.messages || []);
    } catch (error) {
      if (force && !messagesBox.children.length) {
        messagesBox.innerHTML = '<div class="support-empty error">Suporte temporariamente indisponível.</div>';
      }
    } finally {
      loading = false;
    }
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const message = textarea.value.trim();
    if (!message) return;

    const submit = form.querySelector("button");
    submit.disabled = true;

    try {
      await api("/api/support/messages", {
        method: "POST",
        body: JSON.stringify({ message }),
      });
      textarea.value = "";
      textarea.style.height = "";
      await refreshMessages(true);
    } catch (error) {
      const warning = document.createElement("div");
      warning.className = "support-inline-error";
      warning.textContent = error.message;
      messagesBox.appendChild(warning);
      messagesBox.scrollTop = messagesBox.scrollHeight;
    } finally {
      submit.disabled = false;
      textarea.focus();
    }
  });

  textarea.addEventListener("input", () => {
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 110) + "px";
  });

  textarea.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  fab.addEventListener("click", () => setOpen(true));
  close.addEventListener("click", () => setOpen(false));

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && open) setOpen(false);
  });
})();
