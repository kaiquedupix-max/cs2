(async () => {
  const root = document.getElementById("prod-root");
  const slug = decodeURIComponent(location.pathname.split("/").filter(Boolean).pop() || "");
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const money = (cents) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  let catalog = [];
  try { catalog = await (await fetch("/api/catalog", { cache: "no-store" })).json(); } catch {}
  const p = catalog.find((x) => x.slug === slug);
  if (!p) {
    root.replaceChildren(el("p", "", "Produto não encontrado."), Object.assign(el("a", "prod-back", "← Voltar aos produtos"), { href: "/" }));
    return;
  }
  document.title = p.name + " | Legit Baratinho";

  const back = Object.assign(el("a", "prod-back", "← Todos os produtos"), { href: "/" });
  const head = el("div", "prod-head");
  head.append(el("span", "eyebrow", p.tag.toUpperCase()), el("h1", "", p.name), el("p", "", p.tagline));
  const chips = el("div", "prod-chips");
  for (const t of p.info || []) chips.appendChild(el("span", "", t));

  const left = el("div");
  const funcs = el("section", "prod-block");
  funcs.appendChild(el("h2", "", "Funções"));
  const grid = el("div", "prod-funcs");
  for (const g of p.functions) {
    const box = el("div");
    box.appendChild(el("h3", "", g.title));
    const ul = el("ul");
    for (const i of g.items) ul.appendChild(el("li", "", i));
    box.appendChild(ul);
    grid.appendChild(box);
  }
  funcs.appendChild(grid);
  const tut = el("section", "prod-block");
  tut.appendChild(el("h2", "", "Tutorial"));
  const ol = el("ol");
  for (const s of p.tutorial) ol.appendChild(el("li", "", s));
  tut.appendChild(ol);
  if (p.warning) tut.appendChild(el("p", "prod-warn", p.warning));
  left.append(funcs, tut);

  const right = el("div");
  for (const s of p.screenshots || []) {
    const fig = el("figure", "prod-shot");
    const img = Object.assign(document.createElement("img"), { src: s.src, alt: s.caption, loading: "lazy" });
    fig.append(img, el("figcaption", "", s.caption));
    right.appendChild(fig);
  }

  // Purchase box: plans come from the same config the checkout uses (Mercado Pago for PC products).
  const buy = el("section", "prod-block prod-buy");
  buy.appendChild(el("h2", "", "Comprar"));
  let platform = "android";
  const plansBox = el("div", "prod-plans");
  if (p.mobile) {
    const pf = el("div", "prod-platforms");
    for (const [key, label] of [["android", "Android"], ["ios", "iOS"]]) {
      const b = el("button", key === platform ? "on" : "", label);
      b.type = "button";
      b.addEventListener("click", () => {
        platform = key;
        [...pf.children].forEach((c) => c.classList.toggle("on", c === b));
        render();
      });
      pf.appendChild(b);
    }
    buy.appendChild(pf);
  }
  buy.appendChild(plansBox);
  const note = el("p", "prod-note", "");
  buy.appendChild(note);
  let config = null;
  const referral = () => { try { return localStorage.getItem("lb_referral"); } catch { return null; } };

  function render() {
    plansBox.replaceChildren();
    if (!config) { plansBox.appendChild(el("p", "prod-note", "Planos indisponíveis no momento.")); return; }
    for (const plan of config.plans) {
      const params = new URLSearchParams({ product: p.checkoutProduct, plan: plan.key, lang: "pt", market: String(config.market || "BR").toLowerCase() });
      if (p.mobile) params.set("platform", platform);
      const ref = referral();
      if (ref) params.set("ref", ref);
      const intl = p.mobile && config.market !== "BR";
      const price = intl
        ? (plan.usdPriceCents != null ? "$" + (plan.usdPriceCents / 100).toFixed(2) + " USD" : "USD")
        : (plan.priceCents != null ? money(plan.priceCents) : "—");
      const name = plan.lifetime ? "Permanente" : plan.days + (plan.days === 1 ? " dia" : " dias");
      const a = Object.assign(el("a", "prod-plan"), { href: plan.available ? "/checkout?" + params : "#" });
      a.append(el("span", "", name), el("b", "", price));
      plansBox.appendChild(a);
    }
    note.textContent = config.configured
      ? (config.provider === "stripe" ? "Pagamento internacional por cartão." : "Pagamento por PIX ou cartão, via Mercado Pago.")
      : "Pagamento indisponível no momento.";
  }

  try {
    const r = await fetch("/api/checkout/config?product=" + encodeURIComponent(p.checkoutProduct), { cache: "no-store" });
    if (r.ok) config = await r.json();
  } catch {}
  render();
  right.appendChild(buy);

  const layout = el("div", "prod-layout");
  layout.append(left, right);
  root.replaceChildren(back, head, chips, layout);
})();
