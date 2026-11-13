// Home: one card per catalog entry; clicking a card opens /produto/<slug>.
(async () => {
  const grid = document.getElementById("product-grid");
  if (!grid) return;
  let catalog = [];
  try { catalog = await (await fetch("/api/catalog", { cache: "no-store" })).json(); } catch {}
  grid.replaceChildren();
  if (!catalog.length) {
    const p = document.createElement("p");
    p.textContent = "Produtos indisponíveis no momento.";
    grid.appendChild(p);
    return;
  }
  for (const item of catalog) {
    const card = document.createElement("a");
    card.className = "product-card";
    card.href = "/produto/" + item.slug;

    const visual = document.createElement("div");
    visual.className = "product-visual";
    if (item.art) {
      const img = document.createElement("img");
      img.className = "product-shot";
      img.src = item.art;
      img.alt = item.name;
      img.loading = "lazy";
      visual.appendChild(img);
    } else {
      const glyph = document.createElement("span");
      glyph.className = "visual-glyph";
      glyph.textContent = item.glyph || item.name.slice(0, 2).toUpperCase();
      visual.appendChild(glyph);
    }

    const body = document.createElement("div");
    body.className = "product-body";
    const heading = document.createElement("div");
    heading.className = "product-heading";
    const h3 = document.createElement("h3");
    h3.textContent = item.name;
    const tag = document.createElement("span");
    tag.className = "product-tag" + (item.mobile ? " violet" : "");
    tag.textContent = item.tag;
    heading.append(h3, tag);
    const text = document.createElement("p");
    text.textContent = item.tagline;
    const cta = document.createElement("span");
    cta.className = "primary-btn";
    cta.innerHTML = "<span>Ver funções e comprar</span><span>→</span>";
    body.append(heading, text, cta);

    card.append(visual, body);
    grid.appendChild(card);
  }
})();
