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
        <div class="support-head-actions">
          <button class="support-sound-toggle" type="button" aria-label="Ativar ou desativar sons">🔊</button>
          <button class="support-close" type="button" aria-label="Fechar">×</button>
        </div>
      </header>

      <div class="support-contact-card">
        <form class="support-contact-form">
          <div>
            <strong>Antes de começar</strong>
            <p>Deixe seu e-mail e WhatsApp para podermos responder aqui ou entrar em contato depois.</p>
          </div>
          <label>E-mail
            <input class="support-contact-email" type="email" maxlength="160" autocomplete="email" placeholder="voce@email.com" required>
          </label>
          <label>WhatsApp
            <input class="support-contact-whatsapp" type="tel" maxlength="24" autocomplete="tel" placeholder="(00) 00000-0000" required>
          </label>
          <button type="submit">Continuar para o suporte</button>
          <small>Usaremos esses dados apenas para atendimento e contato relacionado à sua conversa.</small>
        </form>

        <div class="support-contact-saved hidden">
          <div>
            <span>✓</span>
            <p><strong>Contato salvo</strong><small class="support-contact-summary"></small></p>
          </div>
          <button class="support-contact-edit" type="button">Editar</button>
        </div>
      </div>

      <div class="support-intro">
        <strong>Tem alguma dúvida?</strong>
        <p>Mande sua mensagem aqui. Sua conversa fica salva e a resposta aparece neste mesmo chat.</p>
      </div>

      <div class="support-messages" role="log" aria-live="polite"></div>

      <form class="support-form">
        <textarea maxlength="1200" rows="1" placeholder="Digite sua dúvida..." required></textarea>
        <button type="submit" aria-label="Enviar mensagem">➤</button>
      </form>

      <div class="support-footer-status">
        <span>Suporte brasileiro</span>
        <span>•</span>
        <span>✓ enviado</span>
        <span>•</span>
        <span>✓✓ lido</span>
      </div>
    </section>
  `;

  document.body.appendChild(root);

  const fab = root.querySelector(".support-fab");
  const panel = root.querySelector(".support-panel");
  const close = root.querySelector(".support-close");
  const soundToggle = root.querySelector(".support-sound-toggle");
  const messagesBox = root.querySelector(".support-messages");
  const form = root.querySelector(".support-form");
  const textarea = form.querySelector("textarea");
  const intro = root.querySelector(".support-intro");

  const contactCard = root.querySelector(".support-contact-card");
  const contactForm = root.querySelector(".support-contact-form");
  const contactSavedBox = root.querySelector(".support-contact-saved");
  const contactEmail = root.querySelector(".support-contact-email");
  const contactWhatsapp = root.querySelector(".support-contact-whatsapp");
  const contactSummary = root.querySelector(".support-contact-summary");
  const contactEdit = root.querySelector(".support-contact-edit");

  let open = false;
  let loading = false;
  let pollTimer = null;
  let lastSignature = "";
  let contactSaved = false;
  let contactData = { email: "", whatsapp: "" };
  let lastAdminMessageId = null;
  let editingContact = false;
  let audioContext = null;
  let soundEnabled = localStorage.getItem("lb_support_sound") !== "off";

  function ensureAudio() {
    if (!soundEnabled) return null;

    try {
      if (!audioContext) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return null;
        audioContext = new AudioContextClass();
      }

      if (audioContext.state === "suspended") {
        audioContext.resume().catch(() => {});
      }

      return audioContext;
    } catch {
      return null;
    }
  }

  function tone(frequency, duration, gainValue, delay = 0) {
    const ctx = ensureAudio();
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

  function playSound(kind) {
    if (!soundEnabled) return;

    if (kind === "receive") {
      tone(720, 0.12, 0.055);
      tone(920, 0.14, 0.045, 0.105);
      return;
    }

    tone(560, 0.07, 0.04);
  }

  function updateSoundButton() {
    soundToggle.textContent = soundEnabled ? "🔊" : "🔇";
    soundToggle.title = soundEnabled ? "Desativar sons" : "Ativar sons";
  }

  function setSoundEnabled(enabled) {
    soundEnabled = Boolean(enabled);
    localStorage.setItem("lb_support_sound", soundEnabled ? "on" : "off");
    updateSoundButton();

    if (soundEnabled) {
      ensureAudio();
      playSound("send");
    }
  }

  function setOpen(value) {
    open = Boolean(value);
    panel.classList.toggle("open", open);
    panel.setAttribute("aria-hidden", open ? "false" : "true");
    fab.classList.toggle("hidden", open);

    if (open) {
      ensureAudio();
      refreshMessages(true);
      startPolling();
    } else {
      stopPolling();
    }
  }

  function startPolling() {
    stopPolling();
    pollTimer = setInterval(() => {
      if (open) refreshMessages(false);
    }, 3000);
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
      throw Object.assign(
        new Error(data.message || data.error || "Não foi possível falar com o suporte."),
        { status: response.status, data }
      );
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

  function formatWhatsapp(value) {
    const digits = String(value || "").replace(/\D/g, "");
    const local = digits.startsWith("55") ? digits.slice(2) : digits;

    if (local.length === 11) {
      return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
    }

    if (local.length === 10) {
      return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
    }

    return value || "";
  }

  function applyWhatsappMask() {
    let digits = contactWhatsapp.value.replace(/\D/g, "");
    if (digits.startsWith("55") && digits.length > 11) {
      digits = digits.slice(2);
    }
    digits = digits.slice(0, 11);

    if (digits.length <= 2) {
      contactWhatsapp.value = digits;
    } else if (digits.length <= 6) {
      contactWhatsapp.value = `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    } else if (digits.length <= 10) {
      contactWhatsapp.value = `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    } else {
      contactWhatsapp.value = `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
  }

  function renderContactState() {
    const ready = Boolean(contactData.email && contactData.whatsapp);
    contactSaved = ready;

    contactForm.classList.toggle("hidden", ready && !editingContact);
    contactSavedBox.classList.toggle("hidden", !ready || editingContact);
    intro.classList.toggle("support-locked", !ready);
    messagesBox.classList.toggle("support-locked", !ready);
    form.classList.toggle("support-locked", !ready);

    textarea.disabled = !ready;
    form.querySelector("button").disabled = !ready;

    if (ready) {
      contactSummary.textContent =
        contactData.email + " • " + formatWhatsapp(contactData.whatsapp);
    } else {
      if (!contactEmail.value) {
        contactEmail.value = localStorage.getItem("lb_support_email") || "";
      }
      if (!contactWhatsapp.value) {
        contactWhatsapp.value = localStorage.getItem("lb_support_whatsapp") || "";
      }
    }
  }

  function receiptFor(message) {
    if (message.sender !== "visitor") return "";
    return message.readAt ? " ✓✓" : " ✓";
  }

  function renderMessages(messages) {
    const signature = JSON.stringify(
      (messages || []).map((item) => [item.id, item.sender, item.body, item.readAt || null])
    );

    const adminIds = (messages || [])
      .filter((item) => item.sender === "admin")
      .map((item) => Number(item.id || 0));
    const newestAdminId = adminIds.length ? Math.max(...adminIds) : 0;

    if (lastAdminMessageId !== null && newestAdminId > lastAdminMessageId) {
      playSound("receive");
    }

    if (lastAdminMessageId === null || newestAdminId > lastAdminMessageId) {
      lastAdminMessageId = newestAdminId;
    }

    if (signature === lastSignature) return;
    lastSignature = signature;

    messagesBox.innerHTML = "";

    if (!messages?.length) {
      messagesBox.innerHTML =
        '<div class="support-empty">Envie a primeira mensagem e fale diretamente com o suporte.</div>';
      intro.classList.remove("hidden");
      return;
    }

    intro.classList.add("hidden");

    for (const message of messages) {
      const bubble = document.createElement("div");
      bubble.className =
        "support-message " + (message.sender === "admin" ? "admin" : "visitor");

      const body = document.createElement("p");
      body.textContent = message.body;

      const meta = document.createElement("small");
      meta.className = message.readAt ? "read" : "";
      meta.textContent =
        (message.sender === "admin" ? "Suporte" : "Você") +
        " • " +
        timeLabel(message.createdAt) +
        receiptFor(message);

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
      const contact = data.conversation?.contact || {};

      if (!editingContact) {
        contactData = {
          email: contact.email || "",
          whatsapp: contact.whatsapp || "",
        };
      }

      renderContactState();
      renderMessages(data.messages || []);
    } catch (error) {
      if (force && !messagesBox.children.length) {
        messagesBox.innerHTML =
          '<div class="support-empty error">Suporte temporariamente indisponível.</div>';
      }
    } finally {
      loading = false;
    }
  }

  contactForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const email = contactEmail.value.trim();
    const whatsapp = contactWhatsapp.value.trim();
    const button = contactForm.querySelector("button[type='submit']");

    button.disabled = true;
    button.textContent = "Salvando...";

    try {
      const data = await api("/api/support/contact", {
        method: "POST",
        body: JSON.stringify({ email, whatsapp }),
      });

      contactData = {
        email: data.contact?.email || email,
        whatsapp: data.contact?.whatsapp || whatsapp,
      };
      editingContact = false;

      localStorage.setItem("lb_support_email", contactData.email);
      localStorage.setItem("lb_support_whatsapp", formatWhatsapp(contactData.whatsapp));

      renderContactState();
      playSound("send");
      textarea.focus();
    } catch (error) {
      const warning = document.createElement("div");
      warning.className = "support-contact-error";
      warning.textContent = error.message;

      contactForm.querySelector(".support-contact-error")?.remove();
      contactForm.appendChild(warning);
    } finally {
      button.disabled = false;
      button.textContent = "Continuar para o suporte";
    }
  });

  contactEdit.addEventListener("click", () => {
    editingContact = true;
    contactEmail.value = contactData.email || "";
    contactWhatsapp.value = formatWhatsapp(contactData.whatsapp || "");
    renderContactState();
    contactEmail.focus();
  });

  contactWhatsapp.addEventListener("input", applyWhatsappMask);

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!contactSaved) {
      contactEmail.focus();
      return;
    }

    const message = textarea.value.trim();
    if (!message) return;

    const submit = form.querySelector("button");
    submit.disabled = true;

    try {
      const result = await api("/api/support/messages", {
        method: "POST",
        body: JSON.stringify({ message }),
      });

      playSound("send");

      textarea.value = "";
      textarea.style.height = "";

      if (result.message) {
        lastSignature = "";
      }

      await refreshMessages(true);
    } catch (error) {
      const warning = document.createElement("div");
      warning.className = "support-inline-error";
      warning.textContent = error.message;
      messagesBox.appendChild(warning);
      messagesBox.scrollTop = messagesBox.scrollHeight;
    } finally {
      submit.disabled = !contactSaved;
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

  soundToggle.addEventListener("click", () => {
    setSoundEnabled(!soundEnabled);
  });

  fab.addEventListener("click", () => setOpen(true));
  close.addEventListener("click", () => setOpen(false));

  document.addEventListener(
    "pointerdown",
    () => {
      if (soundEnabled) ensureAudio();
    },
    { once: true }
  );

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && open) setOpen(false);
  });

  updateSoundButton();
  renderContactState();
})();
