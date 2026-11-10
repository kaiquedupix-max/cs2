document.getElementById("year") && (document.getElementById("year").textContent = new Date().getFullYear());

async function refreshPublicStatus() {
  try {
    const response = await fetch("/api/status", { cache: "no-store" });
    const data = await response.json();
    const names = { online: "ONLINE", maintenance: "MANUTENÇÃO", offline: "OFFLINE" };
    const label = document.getElementById("statusLabel");
    const pill = document.getElementById("statusPill");
    const dot = document.getElementById("statusDot");
    const catalog = document.getElementById("catalogStatus");
    const catalogDot = document.getElementById("catalogStatusDot");

    if (label) label.textContent = data.message || names[data.status] || "Indisponível";
    if (pill) {
      pill.className = "status-pill " + (data.status || "maintenance");
      pill.textContent = names[data.status] || "STATUS";
    }
    if (dot) dot.className = "status-dot " + (data.status || "maintenance");
    if (catalog) catalog.textContent = names[data.status] || "INDISPONÍVEL";
    if (catalogDot) catalogDot.className = "status-dot " + (data.status || "maintenance");
  } catch {
    document.querySelectorAll(".status-dot").forEach((el) => el.className = "status-dot maintenance");
  }
}
refreshPublicStatus();
setInterval(refreshPublicStatus, 30000);

const productStatusNames = {
  online: "ONLINE",
  maintenance: "MANUTENÇÃO",
  offline: "OFFLINE",
  coming_soon: "EM BREVE",
  presale: "PRÉ-VENDA",
};
const publicStatusTabs = Array.from(document.querySelectorAll("[data-status-product]"));
let publicProductStatuses = {};

function activateProductStatus(product) {
  const selected = publicProductStatuses[product];
  if (!selected) return;
  publicStatusTabs.forEach((tab) => {
    const active = tab.dataset.statusProduct === product;
    tab.classList.toggle("active", active);
    tab.setAttribute("aria-selected", String(active));
    tab.tabIndex = active ? 0 : -1;
  });
  const panel = document.getElementById("status-panel");
  panel.setAttribute("aria-labelledby", "status-tab-" + product);
  document.getElementById("product-status-name").textContent = selected.name;
  const pill = document.getElementById("product-status-pill");
  pill.textContent = productStatusNames[selected.status] || "INDISPONÍVEL";
  pill.dataset.state = selected.status;
  document.getElementById("product-status-message").textContent = selected.message;
  document.getElementById("product-status-disclaimer").textContent =
    product === "counterFrameIos" && selected.status === "presale"
      ? "Pré-venda iOS: o acesso ainda não está disponível. O lançamento não possui data confirmada."
      : "Status informativo publicado pela equipe; pode ser alterado sem aviso.";
}

publicStatusTabs.forEach((tab, index) => {
  tab.addEventListener("click", () => activateProductStatus(tab.dataset.statusProduct));
  tab.addEventListener("keydown", (event) => {
    if (!["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const targetIndex = event.key === "Home" ? 0 :
      event.key === "End" ? publicStatusTabs.length - 1 :
      (index + (event.key === "ArrowRight" ? 1 : -1) + publicStatusTabs.length) % publicStatusTabs.length;
    publicStatusTabs[targetIndex].focus();
    activateProductStatus(publicStatusTabs[targetIndex].dataset.statusProduct);
  });
});

async function refreshProductStatusBoard() {
  if (!publicStatusTabs.length) return;
  try {
    const response = await fetch("/api/product-statuses", { cache: "no-store" });
    if (!response.ok) throw new Error("Status indisponível");
    publicProductStatuses = await response.json();
    publicStatusTabs.forEach((tab) => {
      const state = publicProductStatuses[tab.dataset.statusProduct]?.status || "offline";
      tab.dataset.state = state;
      tab.querySelector(".status-tab-label").textContent = productStatusNames[state] || "INDISPONÍVEL";
    });
    const current = publicStatusTabs.find(tab => tab.getAttribute("aria-selected") === "true");
    activateProductStatus(current?.dataset.statusProduct || "cs2");
  } catch {
    publicStatusTabs.forEach((tab) => {
      tab.querySelector(".status-tab-label").textContent = "INDISPONÍVEL";
      tab.dataset.state = "offline";
    });
    document.getElementById("product-status-message").textContent =
      "Não foi possível consultar os status agora. Tente novamente mais tarde.";
  }
}
refreshProductStatusBoard();
setInterval(refreshProductStatusBoard, 30000);

const glow = document.getElementById("cursorGlow");
if (glow && matchMedia("(pointer:fine)").matches) {
  window.addEventListener("pointermove", (event) => {
    glow.style.transform = `translate3d(${event.clientX - 220}px,${event.clientY - 220}px,0)`;
  });
}

const revealObserver = new IntersectionObserver((entries) => {
  entries.forEach((entry) => {
    if (entry.isIntersecting) {
      entry.target.classList.add("visible");
      revealObserver.unobserve(entry.target);
    }
  });
}, { threshold: .14 });
document.querySelectorAll(".reveal").forEach((el) => revealObserver.observe(el));

if (matchMedia("(pointer:fine)").matches) {
  document.querySelectorAll(".tilt").forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      const rect = card.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width - .5;
      const py = (event.clientY - rect.top) / rect.height - .5;
      card.style.setProperty("--rx", `${-py * 3.5}deg`);
      card.style.setProperty("--ry", `${px * 5}deg`);
    });
    card.addEventListener("pointerleave", () => {
      card.style.setProperty("--rx", "0deg");
      card.style.setProperty("--ry", "0deg");
    });
  });

  document.querySelectorAll(".magnetic").forEach((button) => {
    button.addEventListener("pointermove", (event) => {
      const rect = button.getBoundingClientRect();
      button.style.transform = `translate(${(event.clientX - rect.left - rect.width/2) * .08}px,${(event.clientY - rect.top - rect.height/2) * .08}px)`;
    });
    button.addEventListener("pointerleave", () => button.style.transform = "");
  });
}
