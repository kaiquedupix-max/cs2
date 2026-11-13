// Admin shell: top tabs, sub-tabs, finance overview and the client detail drawer.
// Depends on admin.js (api, escapeHtml, setAdminProduct, setClientGame, loadClients, adminProduct).
(() => {
  const $ = (id) => document.getElementById(id);
  const fmtBRL = (v) => "R$ " + Number(v || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtUSD = (v) => "US$ " + Number(v || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmtDate = (v) => (v ? new Date(v).toLocaleString("pt-BR") : "—");
  const revenueText = (rev = {}, stars = 0) => {
    const parts = [];
    if (rev.BRL) parts.push(fmtBRL(rev.BRL));
    if (rev.USD) parts.push(fmtUSD(rev.USD));
    if (stars) parts.push(stars + " ⭐");
    return parts.length ? parts.join(" + ") : fmtBRL(0);
  };
  const esc = (t) => escapeHtml(String(t ?? ""));

  // ---------- tabs ----------
  let pcGame = "cs2";
  let clientsGame = "cs2";

  function showTab(name) {
    document.querySelectorAll("#admNav button").forEach((b) => b.classList.toggle("active", b.dataset.tab === name));
    document.querySelectorAll(".adm-tab").forEach((t) => t.classList.toggle("hidden", t.id !== "tab-" + name));
    try { sessionStorage.setItem("adm_tab", name); } catch {}
    if (name === "overview") loadOverview();
    if (name === "pc") setAdminProduct(pcGame);
    if (name === "clients") setClientGame(clientsGame);
  }
  document.querySelectorAll("#admNav button").forEach((b) => b.addEventListener("click", () => showTab(b.dataset.tab)));

  const activate = (group, button) => group.querySelectorAll("button").forEach((b) => b.classList.toggle("active", b === button));
  document.querySelectorAll('.adm-subnav[data-for="pc"] button').forEach((b) => b.addEventListener("click", () => {
    activate(b.parentElement, b); pcGame = b.dataset.game; setAdminProduct(pcGame);
  }));
  document.querySelectorAll('.adm-subnav[data-for="clients"] button').forEach((b) => b.addEventListener("click", () => {
    activate(b.parentElement, b); clientsGame = b.dataset.game; closeDrawer(); setClientGame(clientsGame);
  }));
  document.querySelectorAll('.adm-subnav[data-for="mobile"] button').forEach((b) => b.addEventListener("click", () => {
    activate(b.parentElement, b);
    document.querySelectorAll("#tab-mobile [data-sub-panel]").forEach((p) => { p.hidden = p.dataset.subPanel !== b.dataset.sub; });
  }));

  // ---------- overview ----------
  const monthInput = $("ovMonth");
  const now = new Date();
  if (monthInput) monthInput.value = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  function bars(target, items, valueOf) {
    target.replaceChildren();
    const max = Math.max(1, ...items.map((i) => i.sales));
    if (!items.length) { target.innerHTML = '<p class="admin-muted">Sem vendas neste mês.</p>'; return; }
    for (const item of items) {
      const row = document.createElement("div");
      row.className = "adm-bar-row";
      row.innerHTML = `<div class="adm-bar-head"><b>${esc(item.label)}</b><span>${item.sales} venda(s) • ${esc(valueOf(item))}</span></div>
        <div class="adm-bar"><i style="width:${Math.round((item.sales / max) * 100)}%"></i></div>`;
      if (item.via && item.via.length) {
        const sub = document.createElement("small");
        sub.className = "admin-muted";
        sub.textContent = item.via.map((v) => `${v.label}: ${v.sales}`).join(" • ");
        row.appendChild(sub);
      }
      target.appendChild(row);
    }
  }

  async function loadOverview() {
    if (!monthInput) return;
    let d;
    try { d = await api("/api/admin/overview?month=" + encodeURIComponent(monthInput.value)); }
    catch (e) { $("ovMetrics").innerHTML = `<p class="error">${esc(e.message)}</p>`; return; }

    const brl = d.totals.revenue.BRL || 0, prev = d.totals.previous.revenue.BRL || 0;
    const delta = prev > 0 ? Math.round(((brl - prev) / prev) * 100) : null;
    const ticket = d.totals.sales ? brl / d.totals.sales : 0;
    const cards = [
      ["Faturamento do mês", fmtBRL(brl), delta === null ? "sem mês anterior para comparar" : `${delta >= 0 ? "+" : ""}${delta}% vs mês anterior`],
      ["Vendas", String(d.totals.sales), `mês anterior: ${d.totals.previous.sales}`],
      ["Ticket médio", fmtBRL(ticket), "somente em reais"],
      ["Mais vendido", d.top ? d.top.label : "—", d.top ? d.top.sales + " venda(s)" : "sem vendas"],
    ];
    if (d.totals.revenue.USD) cards.push(["Faturamento em dólar", fmtUSD(d.totals.revenue.USD), "Stripe / bot"]);
    if (d.totals.stars) cards.push(["Telegram Stars", d.totals.stars + " ⭐", "vendas pelo bot"]);
    $("ovMetrics").innerHTML = cards.map(([t, v, s]) =>
      `<div class="adm-metric"><small>${esc(t)}</small><strong>${esc(v)}</strong><span>${esc(s)}</span></div>`).join("");

    bars($("ovGateway"), d.byGateway, (i) => revenueText(i.revenue, i.stars));
    bars($("ovProduct"), d.byProduct, (i) => revenueText(i.revenue, i.stars));

    const max = Math.max(1, ...d.daily.map((x) => x.BRL));
    $("ovDaily").innerHTML = d.daily.map((x) =>
      `<div class="adm-day" title="${esc(x.date)}: ${x.sales} venda(s), ${esc(fmtBRL(x.BRL))}"><i style="height:${Math.round((x.BRL / max) * 100)}%"></i><span>${x.date.slice(8)}</span></div>`).join("");

    $("ovRecent").innerHTML = d.recent.length
      ? d.recent.map((r) => `<tr><td>${esc(fmtDate(r.at))}</td><td>${esc(r.who)}</td><td>${esc(r.product)}</td><td>${esc(r.gateway)}</td><td><b>${esc(r.amount)}</b></td></tr>`).join("")
      : '<tr><td colspan="5" class="admin-muted">Sem vendas neste mês.</td></tr>';
    $("ovNote").textContent = d.note;
  }
  monthInput?.addEventListener("change", loadOverview);
  $("ovRefresh")?.addEventListener("click", loadOverview);

  // ---------- client drawer ----------
  const drawer = $("clientDrawer");
  function closeDrawer() { drawer?.classList.add("hidden"); }
  $("cdClose")?.addEventListener("click", closeDrawer);
  const STATUS = { active: ["Ativa", "ok"], expired: ["Expirada", "bad"], revoked: ["Revogada", "bad"] };

  async function openClient(id) {
    drawer.classList.remove("hidden");
    $("cdTitle").textContent = "Carregando…";
    $("cdBody").replaceChildren();
    let d;
    try { d = await api(`/api/admin/clients/${id}/detail`); }
    catch (e) { $("cdTitle").textContent = "Erro"; $("cdBody").innerHTML = `<p class="error">${esc(e.message)}</p>`; return; }
    const c = d.client;
    $("cdTitle").textContent = c.username;

    const licenses = d.licenses.length ? d.licenses.map((l) => {
      const [label, cls] = STATUS[l.status] || [l.status, "neutral"];
      const validity = l.lifetime ? "Vitalícia" : (l.status === "active" ? `${l.daysRemaining} dia(s) • até ${fmtDate(l.expiresAt)}` : (l.expiresAt ? "expirou em " + fmtDate(l.expiresAt) : "—"));
      return `<tr><td>${esc(l.label)}</td><td>${esc(l.plan)}</td><td><span class="tag ${cls}">${label}</span></td><td>${esc(validity)}</td><td>${esc(l.origin)}</td></tr>`;
    }).join("") : '<tr><td colspan="5" class="admin-muted">Nenhum produto adquirido.</td></tr>';

    const payments = d.payments.length ? d.payments.map((p) =>
      `<tr><td>${esc(fmtDate(p.paidAt || p.createdAt))}</td><td>${esc(p.product)}</td><td>${esc(p.plan || "—")}</td><td>${esc(p.gateway)}</td><td>${esc((p.currency === "USD" ? "US$ " : "R$ ") + Number(p.amount || 0).toFixed(2))}</td><td>${esc(p.status)}</td></tr>`).join("")
      : '<tr><td colspan="6" class="admin-muted">Sem pagamentos pelo site.</td></tr>';

    const keys = d.keys.length ? `<h4>Keys (Counter Flame)</h4><div class="table-wrap"><table><thead><tr><th>Plano</th><th>Dias</th><th>Origem</th><th>Ativada</th><th>Expira</th></tr></thead><tbody>${
      d.keys.map((k) => `<tr><td>${esc(k.plan)}</td><td>${esc(k.days)}</td><td>${esc(k.via)}</td><td>${esc(fmtDate(k.activatedAt))}</td><td>${esc(k.revoked ? "revogada" : fmtDate(k.expiresAt))}</td></tr>`).join("")
    }</tbody></table></div>` : "";

    $("cdBody").innerHTML = `
      <div class="adm-client-head">
        <div><b>${esc(c.email)}</b><small>Cadastro: ${esc(fmtDate(c.createdAt))}</small></div>
        <div><span class="tag ${c.hwidBound ? "ok" : "neutral"}">${c.hwidBound ? "PC vinculado" : "HWID livre"}</span> <span class="tag ${c.banned ? "bad" : "ok"}">${c.banned ? "Banido" : "Ativo"}</span></div>
      </div>
      <div class="client-actions adm-client-actions">
        <button class="button ghost small" data-act="days" data-game="cs2">+ Dias CS2</button>
        <button class="button ghost small" data-act="days" data-game="combatarms">+ Dias Combat Arms</button>
        <button class="button ghost small" data-act="hwid" ${c.hwidBound ? "" : "disabled"}>Reset HWID</button>
        <button class="button ${c.banned ? "primary" : "danger"} small" data-act="ban">${c.banned ? "Desbanir" : "Banir"}</button>
      </div>
      <h4>Licenças e acessos</h4>
      <div class="table-wrap"><table><thead><tr><th>Jogo</th><th>Plano</th><th>Status</th><th>Validade</th><th>Comprado por</th></tr></thead><tbody>${licenses}</tbody></table></div>
      <h4>Compras pelo site</h4>
      <div class="table-wrap"><table><thead><tr><th>Data</th><th>Produto</th><th>Plano</th><th>Gateway</th><th>Valor</th><th>Status</th></tr></thead><tbody>${payments}</tbody></table></div>
      ${keys}`;

    $("cdBody").querySelectorAll("[data-act]").forEach((btn) => btn.addEventListener("click", async () => {
      const act = btn.dataset.act;
      try {
        if (act === "days") {
          const amount = prompt(`Quantos dias de ${btn.dataset.game === "cs2" ? "CS2" : "Combat Arms"} adicionar para ${c.username}?`, "30");
          if (amount === null) return;
          const days = Number(amount);
          if (!Number.isInteger(days) || days < 1 || days > 3650) { alert("Informe um número entre 1 e 3650."); return; }
          await api(`/api/admin/clients/${id}/add-days`, { method: "POST", headers: { "x-product": btn.dataset.game }, body: JSON.stringify({ days, plan: "admin" }) });
        } else if (act === "hwid") {
          if (!confirm("Resetar o HWID deste cliente? O próximo computador que fizer login será vinculado.")) return;
          await api(`/api/admin/clients/${id}/reset-hwid`, { method: "POST" });
        } else if (act === "ban") {
          if (!confirm(c.banned ? "Desbanir este cliente?" : "Banir este cliente? Ele perderá acesso ao site e ao loader.")) return;
          await api(`/api/admin/clients/${id}/${c.banned ? "unban" : "ban"}`, { method: "POST" });
        }
      } catch (e) { alert(e.message); return; }
      await openClient(id);
      loadClients();
    }));
  }

  document.addEventListener("click", (event) => {
    const open = event.target.closest?.(".client-open");
    if (open) openClient(Number(open.dataset.id));
  });

  // ---------- support badge ----------
  const unread = $("supportUnreadTotal"), badge = $("admSupportBadge");
  if (unread && badge) {
    const sync = () => { const n = parseInt(unread.textContent, 10) || 0; badge.textContent = String(n); badge.classList.toggle("hidden", n === 0); };
    new MutationObserver(sync).observe(unread, { childList: true, characterData: true, subtree: true });
    sync();
  }

  window.addEventListener("admin:ready", () => {
    let start = "overview";
    try { start = sessionStorage.getItem("adm_tab") || "overview"; } catch {}
    if (location.hash === "#counterframe-telegram") start = "mobile";
    showTab(start);
    if (start === "mobile" && location.hash === "#counterframe-telegram") {
      document.querySelector('.adm-subnav[data-for="mobile"] button[data-sub="telegram"]')?.click();
    }
  });
})();
