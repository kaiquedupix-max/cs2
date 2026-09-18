document.getElementById("year").textContent = new Date().getFullYear();

async function loadStatus() {
  const label = document.getElementById("statusLabel");
  const pill = document.getElementById("statusPill");
  try {
    const response = await fetch("/api/status", { cache: "no-store" });
    const data = await response.json();
    const names = {
      online: "Online",
      maintenance: "Manutenção",
      offline: "Offline",
    };
    label.textContent = data.message || names[data.status] || "Indisponível";
    pill.className = "status-pill " + (data.status || "maintenance");
    pill.textContent = names[data.status]?.toUpperCase() || "STATUS";
  } catch {
    label.textContent = "Status temporariamente indisponível.";
    pill.className = "status-pill maintenance";
    pill.textContent = "MANUTENÇÃO";
  }
}
loadStatus();
setInterval(loadStatus, 30000);