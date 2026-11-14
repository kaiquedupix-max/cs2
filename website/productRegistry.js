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
    // Launched inside the loader today. Switching to the standalone payload = set type "external-exe" (one line + deploy);
    // the payload is already served from the cs2-payload channel (releaseChannel), never from the loader's own cs2 channel.
    // preferPayload: while cs2-payload has an active signed release the catalog reports "external-exe" and the loader runs the
    // standalone product; with none (or after it is disabled) the loader falls back to the embedded CS2. No deploy needed to switch.
    launch: { type: "in-process", fileName: "LegitBaratinhoCS2.exe", requiresAdmin: false, preferPayload: true },
    releaseChannel: "cs2-payload",
    dependencies: [],
  },
  combatarms: {
    name: "Combat Arms Brasil Server",
    glyph: "CA",
    notice: "Para o overlay funcionar, use o jogo em modo janela na resolução do monitor e pressione F7 dentro da partida (tela cheia sem bordas). O jogo e o external precisam rodar como administrador.",
    kind: "product",
    platform: "windows",
    channel: "stable",
    sellable: true,
    requireSignature: true,
    ciPublish: true,
    allowedExtensions: [".exe"],
    launch: { type: "external-exe", fileName: "cbr.exe", requiresAdmin: true },
    dependencies: [],
  },
  // Release channel for the standalone CS2 product executable; licensed through cs2. The cs2 channel itself still
  // carries the loader executable that deployed loaders download for self-update, so a payload must never go there.
  "cs2-payload": {
    name: "CS2 Payload",
    kind: "loader",
    accessProduct: "cs2",
    platform: "windows",
    channel: "stable",
    sellable: false,
    requireSignature: true,
    ciPublish: true,
    allowedExtensions: [".exe"],
    launch: { type: "external-exe", fileName: "LegitBaratinhoCS2.exe", requiresAdmin: false },
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
  if ((launchType === "external-exe" || fileName) && !/^[A-Za-z0-9._-]{1,80}\.exe$/i.test(fileName)) fail("launch.fileName");
  const releaseChannel = def.releaseChannel ? String(def.releaseChannel) : "";
  if (releaseChannel && (releaseChannel === code || !existing[releaseChannel] || existing[releaseChannel].kind !== "loader" ||
      existing[releaseChannel].accessProduct !== code)) {
    // Builtin products may reference a channel declared after them; createRegistry re-checks once everything is loaded.
    if (!def.__deferChannelCheck) fail("releaseChannel");
  }
  const allowedExtensions = (def.allowedExtensions || [".exe"]).map((e) => String(e).toLowerCase());
  if (!allowedExtensions.length || !allowedExtensions.every((e) => EXT_RE.test(e))) fail("allowedExtensions");
  let accessProduct;
  if (kind === "loader") {
    accessProduct = String(def.accessProduct || "");
    if (!existing[accessProduct] || existing[accessProduct].kind !== "product") fail("accessProduct");
  }
  // Signed releases (CI attestation) are mandatory for every external payload unless explicitly disabled.
  const requireSignature = def.requireSignature !== undefined ? Boolean(def.requireSignature) : kind === "product" && launchType === "external-exe";
  // ciPublish: the product's CI may publish to this channel without the admin password, authorised by the release signature
  // alone (see requireAdminOrCiRelease). Opt-in, only meaningful on signed channels.
  const ciPublish = requireSignature && def.ciPublish === true;
  const preferPayload = Boolean(def.launch?.preferPayload);
  if (preferPayload && !releaseChannel) fail("preferPayload_needs_releaseChannel");
  const dependencies = [...new Set((def.dependencies || []).map(String))];
  for (const dep of dependencies) if (dep === code || !existing[dep]) fail("dependency:" + dep);
  const glyph = String(def.glyph || name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2)).toUpperCase().slice(0, 3);
  const notice = String(def.notice || "").trim().slice(0, 400);
  return {
    name, glyph, notice, kind, platform: String(def.platform || "windows").slice(0, 16),
    channel: String(def.channel || "stable").slice(0, 16),
    sellable: kind === "product" && def.sellable !== false,
    allowedExtensions,
    requireSignature,
    ciPublish,
    launch: { type: launchType, fileName: fileName || undefined, requiresAdmin: Boolean(def.launch?.requiresAdmin), ...(preferPayload ? { preferPayload } : {}) },
    ...(releaseChannel ? { releaseChannel } : {}),
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
    // Channel whose releases are served when this product is launched (default: the product's own channel).
    releaseChannelOf: (code) => products[code]?.releaseChannel || code,
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
  for (const [code, def] of Object.entries(builtin)) products[code] = normalizeProductDef(code, { ...def, __deferChannelCheck: true }, products);
  for (const [code, def] of Object.entries(products)) {
    const ch = def.releaseChannel;
    if (ch && (ch === code || !products[ch] || products[ch].kind !== "loader" || products[ch].accessProduct !== code)) {
      throw new Error("invalid_product:releaseChannel:" + code);
    }
  }
  return api;
}
