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
