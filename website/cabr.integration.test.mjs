// Integration check for the "combatarms" product against an in-memory Postgres (PGlite). No real payments.
// Needs: npm i --no-save @electric-sql/pglite-socket   (dev only)
// Run:   node cabr.integration.test.mjs [path\to\integration.exe]   (optional loader harness from cabr-loader)
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import pg from "pg";
import { TERMS_VERSION } from "./terms.js";
import { buildAttestation, signPayload } from "./tools/make-attestation.mjs";

// combatarms is a signed channel: releases carry a CI attestation, the server only knows the public key.
const { privateKey: CI_PRIV, publicKey: CI_PUB } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const CI_PRIV_PEM = CI_PRIV.export({ type: "pkcs8", format: "pem" }).toString();

const DB_PORT = 54329, WEB_PORT = 3999, BASE = `http://127.0.0.1:${WEB_PORT}`;
const DB_URL = `postgres://postgres:postgres@127.0.0.1:${DB_PORT}/postgres`;
let fails = 0;
const check = (ok, name, detail = "") => {
  if (!ok) fails++;
  console.log((ok ? "ok   " : "FAIL ") + name + (ok ? "" : " :: " + detail));
};

const db = await PGlite.create();
const dbServer = new PGLiteSocketServer({ db, port: DB_PORT, host: "127.0.0.1", maxConnections: 20 });
await dbServer.start();

const web = spawn(process.execPath, ["server.js"], {
  env: { ...process.env, DATABASE_URL: DB_URL, PORT: String(WEB_PORT), SESSION_SECRET: "test-secret-0123456789", RELEASE_PUBLIC_KEY: CI_PUB.export({ type: "spki", format: "pem" }).toString(),
         ADMIN_PASSWORD: "admin-test-pass", PUBLIC_URL: BASE, MP_PUBLIC_KEY: "", MP_ACCESS_TOKEN: "", MP_WEBHOOK_SECRET: "" },
  stdio: ["ignore", "pipe", "pipe"],
});
let webLog = "";
web.stdout.on("data", (d) => (webLog += d));
web.stderr.on("data", (d) => (webLog += d));

async function call(method, path, { headers = {}, json, raw, cookie } = {}) {
  const h = { ...headers };
  if (cookie) h.cookie = cookie;
  let body;
  if (json !== undefined) { h["content-type"] = "application/json"; body = JSON.stringify(json); }
  if (raw !== undefined) { h["content-type"] = "application/octet-stream"; body = raw; }
  const res = await fetch(BASE + path, { method, headers: h, body, redirect: "manual" });
  const buf = Buffer.from(await res.arrayBuffer());
  let data = null;
  try { data = JSON.parse(buf.toString("utf8")); } catch {}
  return { status: res.status, data, buf, headers: res.headers };
}
const cookieOf = (r, name) => (r.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).find((c) => c.startsWith(name + "="));
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");

let exitCode = 1;
try {
  for (let i = 0; i < 100; i++) {
    try { if ((await fetch(BASE + "/health")).ok) break; } catch {}
    await new Promise((r) => setTimeout(r, 200));
  }

  // --- catalog / checkout config ---
  const cfgCa = await call("GET", "/api/checkout/config?product=combatarms");
  check(cfgCa.status === 200 && cfgCa.data.plans?.length === 1 && cfgCa.data.plans[0].key === "d30" && cfgCa.data.plans[0].priceCents === 2000 && cfgCa.data.plans[0].days === 30,
    "combatarms catalog: single plan d30, R$ 20,00, 30 days", JSON.stringify(cfgCa.data));
  check(cfgCa.data?.configured === false, "checkout reports not configured without Mercado Pago env (no real payment possible)");
  const cfgCs = await call("GET", "/api/checkout/config?product=cs2");
  const cs30 = cfgCs.data?.plans?.find((p) => p.key === "d30");
  check(cfgCs.data?.plans?.length === 7 && cs30?.priceCents === 1990, "cs2 catalog unchanged (7 plans, d30 = R$ 19,90)", JSON.stringify(cfgCs.data?.plans?.length));

  // --- accounts ---
  const mk = async (name) => {
    const r = await call("POST", "/api/account/register", { json: { username: name, email: name + "@example.test", password: "Senha-Teste-123" } });
    return { id: r.data?.user?.id ?? r.data?.account?.user?.id, cookie: cookieOf(r, "lb_user"), status: r.status, data: r.data };
  };
  const A = await mk("cabr_a"), B = await mk("cabr_b"), C = await mk("cabr_c");
  check(A.status === 201 && A.id, "register user A", JSON.stringify(A.data));

  const adminLogin = await call("POST", "/api/admin/login", { json: { password: "admin-test-pass" } });
  const admin = cookieOf(adminLogin, "lb_admin");
  check(adminLogin.status === 200 && admin, "admin login");

  // --- admin panel: grant access per product (this is what the "+ Dias" button calls) ---
  const adminCa = { "x-product": "combatarms" };
  const grantCa = await call("POST", `/api/admin/clients/${B.id}/add-days`, { cookie: admin, headers: adminCa, json: { days: 30, plan: "admin" } });
  check(grantCa.status === 200, "admin grants 30 days of combatarms", JSON.stringify(grantCa.data));
  const listCa = (await call("GET", "/api/admin/clients", { cookie: admin, headers: adminCa })).data?.clients || [];
  const listCs = (await call("GET", "/api/admin/clients", { cookie: admin })).data?.clients || [];
  check(listCa.find((c) => c.id === B.id)?.hasAccess === true && listCs.find((c) => c.id === B.id)?.hasAccess === false,
    "admin client list is per product (B has combatarms, not cs2)");
  const bLogin = await call("POST", "/api/client/login", { json: { identifier: "cabr_b", password: "Senha-Teste-123", hwid: "d".repeat(64) }, headers: { "x-product": "combatarms" } });
  check(bLogin.data?.account?.product?.hasAccess === true && bLogin.data.account.products.length === 1 && bLogin.data.account.products[0].code === "combatarms",
    "customer granted by admin sees combatarms in the loader product list", JSON.stringify(bLogin.data?.account?.products));

  // --- releases are separated per product ---
  const up = (product, name, bytes) => call("POST", `/api/admin/releases/upload?${product ? "product=" + product + "&" : ""}fileName=${name}`, { raw: bytes, cookie: admin });
  // Publishing validates the file type (PE "MZ" for .exe, "PK" for .zip), so fixtures carry real magic bytes.
  const pe = (tag) => Buffer.concat([Buffer.from("MZ"), Buffer.alloc(0x40), Buffer.from(tag)]);
  const csBytes = Buffer.concat([Buffer.from("PK"), Buffer.alloc(8), Buffer.from("CS2-LOADER-BYTES")]);
  const caBytes = pe("CABR-PAYLOAD-BYTES-v1");
  const u1 = await up("cs2", "cs2.zip", csBytes);
  const attestation = JSON.stringify(buildAttestation({ product: "combatarms", version: "1.0.0", fileBytes: caBytes,
    config: { fileName: "cbr.exe", launch: { type: "external-exe", requiresAdmin: true }, compat: { minLoader: "1.21" } } }));
  const u2 = await fetch(`${BASE}/api/admin/releases/upload?product=combatarms&fileName=cbr.exe`, { method: "POST",
    headers: { cookie: admin, "content-type": "application/octet-stream", "x-product": "combatarms", "x-release-attestation": Buffer.from(attestation).toString("base64"), "x-release-signature": signPayload(attestation, CI_PRIV_PEM) }, body: caBytes })
    .then(async (r) => ({ status: r.status }));
  const u3 = await up("combatarms-loader", "CaBrLoader.exe", pe("LOADER-1.0"));
  const u4 = await up("combatarms-loader", "CaBrLoader.exe", pe("LOADER-1.1"));
  check([u1, u2, u3, u4].every((u) => u.status === 201), "upload releases for cs2, combatarms, combatarms-loader x2", [u1, u2, u3, u4].map((u) => u.status).join());
  const lat = async (p) => (await call("GET", "/api/loader/latest", { headers: p ? { "x-product": p } : {} })).data?.version;
  check((await lat("")) === "1.0" && (await lat("combatarms")) === "1.0.0" && (await lat("combatarms-loader")) === "1.1",
    "independent version counters per product (cs2 1.0, combatarms 1.0, loader 1.1)");
  const csLatest = (await call("GET", "/api/loader/latest")).data;
  check(csLatest?.sha256 === sha(csBytes), "uploading combatarms did not replace the active cs2 release");
  const list = await call("GET", "/api/admin/releases?product=combatarms-loader", { cookie: admin });
  check(list.data?.releases?.length === 2 && list.data.releases.filter((r) => r.isActive).length === 1, "admin list is per product; one active release per product");

  // --- loader auth + HWID + license ---
  const H1 = "a".repeat(64), H2 = "b".repeat(64);
  const login = (u, hwid, product = "combatarms", pw = "Senha-Teste-123") =>
    call("POST", "/api/client/login", { json: { identifier: u, password: pw, hwid }, headers: { "x-product": product } });
  const bad = await login("cabr_a", H1, "combatarms", "errada");
  check(bad.status === 401 && bad.data?.error === "invalid_credentials", "wrong password -> 401");
  const badHwid = await login("cabr_a", "xyz");
  check(badHwid.status === 400 && badHwid.data?.error === "invalid_device", "malformed HWID -> 400");

  const la = await login("cabr_a", H1);
  check(la.status === 200 && la.data.account.product.code === "combatarms" && la.data.account.product.hasAccess === false,
    "login without license: product=combatarms, hasAccess=false", JSON.stringify(la.data?.account?.product));
  const tokenA = la.data.token;
  const authA = { authorization: "Bearer " + tokenA, "x-device-id": H1, "x-product": "combatarms" };
  const noLic = await call("GET", "/api/client/release", { headers: authA });
  check(noLic.status === 403 && noLic.data?.error === "access_required", "release without license -> 403 access_required");
  const noLicLoader = await call("GET", "/api/client/release", { headers: { ...authA, "x-product": "combatarms-loader" } });
  check(noLicLoader.status === 403, "loader channel also requires the combatarms license");

  const mismatch = await login("cabr_a", H2);
  check(mismatch.status === 403 && mismatch.data?.error === "hwid_mismatch", "second PC -> hwid_mismatch");
  const stolen = await call("GET", "/api/client/me", { headers: { ...authA, "x-device-id": H2 } });
  check(stolen.status === 403 && stolen.data?.error === "device_mismatch", "token replayed from another PC -> device_mismatch");

  // grant license (stands in for an approved Mercado Pago payment)
  const sql = new pg.Client({ connectionString: DB_URL });
  await sql.connect();
  const grant = (id, product) => sql.query(
    "INSERT INTO user_products(user_id,product_code,plan,purchased_at,expires_at) VALUES($1,$2,'1 mês',NOW(),NOW()+interval '30 days')", [id, product]);
  await grant(A.id, "combatarms");
  await grant(C.id, "cs2");

  const la2 = await login("cabr_a", H1);
  check(la2.data?.account?.product?.hasAccess === true && la2.data.account.product.daysRemaining >= 29, "after license: hasAccess=true, ~30 days");
  const plist = la2.data?.account?.products || [];
  check(plist.length === 1 && plist[0].code === "combatarms" && plist[0].hasAccess === true && plist[0].name.includes("Brasil Server") && plist[0].daysRemaining >= 29,
    "login returns the owned products list (only combatarms for user A)", JSON.stringify(plist));
  const relA = await call("GET", "/api/client/release", { headers: authA });
  check(relA.data?.release?.product === "combatarms", "release metadata echoes the product (loaders refuse mismatches)", JSON.stringify(relA.data));
  const rel = await call("GET", "/api/client/release", { headers: authA });
  check(rel.status === 200 && rel.data.release.version === "1.0.0" && rel.data.release.sha256 === sha(caBytes), "licensed user gets combatarms release metadata");
  const dl = await call("GET", "/api/client/download-loader", { headers: authA });
  check(dl.status === 200 && dl.buf.equals(caBytes) && dl.headers.get("x-content-sha256") === sha(caBytes), "download returns combatarms payload bytes + SHA header");
  const dlLoader = await call("GET", "/api/client/download-loader", { headers: { ...authA, "x-product": "combatarms-loader" } });
  check(dlLoader.status === 200 && dlLoader.buf.equals(pe("LOADER-1.1")), "loader channel serves the active loader build");
  const dlNoDev = await call("GET", "/api/client/download-loader", { headers: { authorization: "Bearer " + tokenA, "x-product": "combatarms" } });
  check(dlNoDev.status === 401, "download without device header -> 401");

  // cross-product isolation: a CS2-only customer can't pull the Combat Arms build
  const lc = await login("cabr_c", H1.replace(/a/g, "c"), "combatarms");
  const authC = { authorization: "Bearer " + lc.data.token, "x-device-id": "c".repeat(64), "x-product": "combatarms" };
  check(lc.data?.account?.product?.hasAccess === false, "CS2-only customer has no combatarms access");
  const cl = lc.data?.account?.products || [];
  check(cl.length === 1 && cl[0].code === "cs2" && cl[0].hasAccess === true, "CS2-only customer's product list shows only cs2", JSON.stringify(cl));
  check((await call("GET", "/api/client/download-loader", { headers: authC })).status === 403, "CS2-only customer cannot download combatarms payload");
  const csDefault = await call("GET", "/api/client/release", { headers: { ...authC, "x-product": "" } });
  check(csDefault.status === 200 && csDefault.data.release.sha256 === sha(csBytes), "no product header keeps the legacy CS2 behaviour");
  const unknown = await call("GET", "/api/client/release", { headers: { ...authC, "x-product": "does-not-exist" } });
  check(unknown.status === 200 && unknown.data.release.sha256 === sha(csBytes), "unknown product falls back to CS2 (never leaks another channel)");

  // --- banned account / expired license ---
  await sql.query("UPDATE user_products SET expires_at = NOW() - interval '1 day' WHERE user_id=$1 AND product_code='combatarms'", [A.id]);
  const exp = await call("GET", "/api/client/release", { headers: authA });
  check(exp.status === 403, "expired license -> 403");
  await sql.query("UPDATE users SET disabled_at=NOW() WHERE id=$1", [A.id]);
  const banned = await login("cabr_a", H1);
  check(banned.status === 403 && banned.data?.error === "account_banned", "banned account cannot log in");
  await sql.end();

  // --- storefront: catalog-driven home + product pages ---
  const cat = (await call("GET", "/api/catalog")).data || [];
  check(cat.length >= 3 && cat.some((p) => p.checkoutProduct === "combatarms" && p.name === "Combat Arms Brasil Server"), "catalog lists CS2, Combat Arms Brasil Server and Counter Flame");
  const ca = cat.find((p) => p.checkoutProduct === "combatarms");
  check(ca && ca.info.includes("Compatível com Windows 10 e 11") && !JSON.stringify(ca).toLowerCase().includes("limita"), "Combat Arms page data: Windows 10/11, no limitations section");
  const page = await call("GET", "/produto/combat-arms-brasil-server");
  const oldUrl = await call("GET", "/produto/combat-arms-external-brasil-7");
  check(oldUrl.status === 200 && (cat.find((p) => p.checkoutProduct === "combatarms")?.aliases || []).includes("combat-arms-external-brasil-7"), "old product URL still served and listed as alias");
  check(page.status === 200 && page.buf.toString().includes("produto.js"), "product page route serves the page shell");
  const home = (await call("GET", "/")).buf.toString();
  check(home.includes('id="product-grid"') && !home.includes("lc-counterflame-cover") && !home.includes('class="hero'), "home is the product grid (hero banner removed)");

  // --- checkout: PC products are Mercado Pago only, regardless of visitor country ---
  for (const prod of ["cs2", "combatarms"]) {
    const cfg = (await call("GET", "/api/checkout/config?product=" + prod, { headers: { "x-forwarded-for": "8.8.8.8" } })).data;
    check(cfg?.provider === "mercadopago" && cfg?.market === "BR", `${prod} checkout uses Mercado Pago (no Stripe)`, JSON.stringify({ p: cfg?.provider, m: cfg?.market }));
  }

  // --- admin finance overview + client detail (seeded paid payments, no real charge) ---
  const fin = new pg.Client({ connectionString: DB_URL });
  await fin.connect();
  const seed = (key, provider, prod, amount, currency) => fin.query(
    `INSERT INTO checkout_payments(user_id,provider,idempotency_key,payment_method,status,amount,buyer_name,buyer_cpf,buyer_email,buyer_phone,process_number,product_code,currency,paid_at)
     VALUES($1,$2,$3,'pix','paid',$4,'Teste Silva','00000000000','t@example.test','+5500000000000','0',$5,$6,NOW())`, [B.id, provider, key, amount, prod, currency]);
  await seed("seed-ca-0000000000001", "mercadopago", "combatarms", 20, "BRL");
  await seed("seed-cs-0000000000002", "mercadopago", "cs2", 19.9, "BRL");
  await seed("seed-cf-0000000000003", "stripe", "counterframe-android", 5, "USD");
  await fin.end();
  const ov = (await call("GET", "/api/admin/overview", { cookie: admin })).data;
  check(ov?.totals?.sales === 3 && Math.abs(ov.totals.revenue.BRL - 39.9) < 0.001 && ov.totals.revenue.USD === 5, "overview totals for the month", JSON.stringify(ov?.totals));
  const gw = Object.fromEntries((ov?.byGateway || []).map((g) => [g.key, g.sales]));
  check(gw.mercadopago === 2 && gw.stripe === 1, "overview splits sales by gateway", JSON.stringify(gw));
  const pr = Object.fromEntries((ov?.byProduct || []).map((g) => [g.key, g.sales]));
  check(pr.combatarms === 1 && pr.cs2 === 1 && pr.counterframe === 1, "overview splits sales by product", JSON.stringify(pr));
  check(ov?.top && ov.daily.length >= 28 && ov.recent.length === 3, "overview has top product, daily series and recent sales");
  check((await call("GET", "/api/admin/overview?month=2020-02", { cookie: admin })).data?.totals?.sales === 0, "other months are empty");
  check((await call("GET", "/api/admin/overview")).status === 401, "overview requires admin");
  const det = (await call("GET", `/api/admin/clients/${B.id}/detail`, { cookie: admin })).data;
  const lic = det?.licenses?.find((l) => l.product === "combatarms");
  check(lic?.status === "active" && lic.label === "Combat Arms Brasil Server" && det.payments.length === 3, "client detail: licenses and purchase history", JSON.stringify(det?.licenses));
  check((await call("GET", `/api/admin/clients/${B.id}/detail`)).status === 401 && (await call("GET", "/api/admin/clients/999999/detail", { cookie: admin })).status === 404, "client detail requires admin / 404 for unknown client");
  check((await call("GET", "/api/admin/clients?game=counterframe", { cookie: admin })).status === 200, "clients list accepts game=counterframe");

  // --- checkout error handling (Mercado Pago not configured, terms) ---
  const payBody = { product: "combatarms", planKey: "d30", method: "pix", termsAccepted: true, termsVersion: TERMS_VERSION };
  const noTerms = await call("POST", "/api/checkout/payment", { cookie: B.cookie, json: { ...payBody, termsAccepted: false } });
  check(noTerms.status === 400 && noTerms.data?.error === "terms_required", "checkout requires accepted terms");
  const noAuth = await call("POST", "/api/checkout/payment", { json: payBody });
  check(noAuth.status === 401, "checkout requires a logged-in site account", String(noAuth.status));
  const unconf = await call("POST", "/api/checkout/payment", { cookie: B.cookie, json: payBody });
  // 127.0.0.1 is not a BR visitor, so the server may route to Stripe; either way no provider is configured here.
  check(unconf.status === 503 && unconf.data?.error === "checkout_not_configured" && String(unconf.data?.message).includes("Mercado Pago"), "checkout without Mercado Pago credentials fails safely (503), nothing charged", JSON.stringify(unconf.data));
  const unknownProd = await call("POST", "/api/checkout/payment", { cookie: B.cookie, json: { ...payBody, product: "other" } });
  check(unknownProd.status === 400 && unknownProd.data?.error === "unknown_product", "unknown product rejected");
  const coupon = await call("POST", "/api/checkout/coupon", { json: { product: "combatarms", planKey: "d30", code: "NOPE123" } });
  check(coupon.status === 400, "invalid coupon rejected for combatarms");

  // --- real loader code against this server ---
  const harness = process.argv[2];
  if (harness) {
    const pass = "Senha-Teste-123";
    await call("POST", "/api/account/register", { json: { username: "cabr_it", email: "cabr_it@example.test", password: pass } });
    const idRow = new pg.Client({ connectionString: DB_URL });
    await idRow.connect();
    const { rows } = await idRow.query("SELECT id FROM users WHERE username='cabr_it'");
    await idRow.query("INSERT INTO user_products(user_id,product_code,plan,purchased_at,expires_at) VALUES($1,'combatarms','1 mês',NOW(),NOW()+interval '30 days')", [rows[0].id]);
    await idRow.end();
    // async spawn: the in-process PGlite server must keep serving queries while the harness runs
    const child = spawn(harness, [BASE, "cabr_it", pass, sha(caBytes)]);
    let out = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (out += d));
    const code = await new Promise((resolve) => child.on("close", resolve));
    process.stdout.write(out);
    check(code === 0, "loader integration harness (real Api class)");
  } else {
    console.log("skip loader harness (pass the path to integration.exe as argv[2])");
  }

  console.log(fails === 0 ? "SITE INTEGRATION: ALL PASSED" : `SITE INTEGRATION: ${fails} FAILED`);
  exitCode = fails === 0 ? 0 : 1;
} catch (e) {
  console.log("ERROR", e);
  console.log(webLog.slice(-2000));
} finally {
  web.kill();
  await dbServer.stop().catch(() => {});
  await db.close().catch(() => {});
  process.exit(exitCode);
}
