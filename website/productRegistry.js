// Single source of truth for loader products. A product is data, not code: add an entry (or POST /api/admin/products)
// and the catalog, licensing, release channels and the loader pick it up without touching the loader core.
//
// kind "product": sellable, has its own license rows (user_products.product_code = code).
// kind "loader":  a release channel for a loader executable; licensed through `accessProduct`.
// launch.type "external-exe": the loader downloads launch.fileName into a per-run workspace and starts it.
// launch.type "in-process":   the product ships inside the loader itself (CS2 today); nothing is downloaded to run it.

const CODE_RE = /^[a-z0-9][a-z0-9-]{1,31}$/;
const EXT_RE = /^\.[a-z0-9]{1,8}$/;

export const BUILTIN_PRODUCTS = {
  cs2: {
    name: "Counter-Strike 2",
    glyph: "CS",
    kind: "product",
    platform: "windows",
    channel: "stable",
    sellable: true,
    allowedExtensions: [".exe", ".zip"],
    launch: { type: "in-process", requiresAdmin: false },
    dependencies: [],
  },
  combatarms: {
    name: "Combat Arms External Brasil 7",
    glyph: "CA",
    notice: "Para o overlay funcionar, use o jogo em modo janela na resolução do monitor e pressione F7 dentro da partida (tela cheia sem bordas). O jogo e o external precisam rodar como administrador.",
    kind: "product",
    platform: "windows",
    channel: "stable",
    sellable: true,
    allowedExtensions: [".exe"],
    launch: { type: "external-exe", fileName: "cbr.exe", requiresAdmin: true },
    dependencies: [],
  },
  "combatarms-loader": {
    name: "CaBr Loader",
    kind: "loader",
    accessProduct: "combatarms",
    platform: "windows",
    channel: "stable",
    sellable: false,
    allowedExtensions: [".exe"],
    launch: { type: "external-exe", fileName: "CaBrLoader.exe", requiresAdmin: false },
    dependencies: [],
  },
};

// Returns the cleaned definition or throws Error("invalid_product:<reason>").
export function normalizeProductDef(code, def, existing = {}) {
  const fail = (why) => { throw new Error("invalid_product:" + why); };
  if (!CODE_RE.test(String(code))) fail("code");
  if (!def || typeof def !== "object") fail("definition");
  const name = String(def.name || "").trim();
  if (name.length < 2 || name.length > 80) fail("name");
  const kind = def.kind === "loader" ? "loader" : "product";
  const launchType = def.launch?.type === "in-process" ? "in-process" : "external-exe";
  const fileName = String(def.launch?.fileName || "");
  if (launchType === "external-exe" && !/^[A-Za-z0-9._-]{1,80}\.exe$/i.test(fileName)) fail("launch.fileName");
  const allowedExtensions = (def.allowedExtensions || [".exe"]).map((e) => String(e).toLowerCase());
  if (!allowedExtensions.length || !allowedExtensions.every((e) => EXT_RE.test(e))) fail("allowedExtensions");
  let accessProduct;
  if (kind === "loader") {
    accessProduct = String(def.accessProduct || "");
    if (!existing[accessProduct] || existing[accessProduct].kind !== "product") fail("accessProduct");
  }
  const dependencies = [...new Set((def.dependencies || []).map(String))];
  for (const dep of dependencies) if (dep === code || !existing[dep]) fail("dependency:" + dep);
  const glyph = String(def.glyph || name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2)).toUpperCase().slice(0, 3);
  const notice = String(def.notice || "").trim().slice(0, 400);
  return {
    name, glyph, notice, kind, platform: String(def.platform || "windows").slice(0, 16),
    channel: String(def.channel || "stable").slice(0, 16),
    sellable: kind === "product" && def.sellable !== false,
    allowedExtensions,
    launch: { type: launchType, fileName: launchType === "external-exe" ? fileName : undefined, requiresAdmin: Boolean(def.launch?.requiresAdmin) },
    dependencies,
    ...(accessProduct ? { accessProduct } : {}),
  };
}

export function createRegistry(builtin = BUILTIN_PRODUCTS) {
  // `products` is a live object: server code that indexes it sees products registered later.
  const products = Object.create(null);
  const api = {
    products,
    has: (code) => Object.hasOwn(products, code),
    get: (code) => (Object.hasOwn(products, code) ? products[code] : null),
    sellable: () => Object.keys(products).filter((c) => products[c].sellable),
    accessProductOf: (code) => products[code]?.accessProduct || code,
    // Strict: unknown or missing -> null. Used by every admin/publish route so a typo never lands in another channel.
    resolveStrict(raw) {
      const code = String(raw ?? "").trim().toLowerCase();
      return code && api.has(code) ? code : null;
    },
    register(code, def) {
      if (api.has(code)) throw new Error("invalid_product:exists");
      products[code] = normalizeProductDef(code, def, products);
      return products[code];
    },
  };
  for (const [code, def] of Object.entries(builtin)) products[code] = normalizeProductDef(code, def, products);
  return api;
}
