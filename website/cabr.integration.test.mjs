// Integration check for the "combatarms" product against an in-memory Postgres (PGlite). No real payments.
// Needs: npm i --no-save @electric-sql/pglite-socket   (dev only)
// Run:   node cabr.integration.test.mjs [path\to\integration.exe]   (optional loader harness from cabr-loader)
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import pg from "pg";
import { TERMS_VERSION } from "./terms.js";

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
  env: { ...process.env, DATABASE_URL: DB_URL, PORT: String(WEB_PORT), SESSION_SECRET: "test-secret-0123456789",
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

  // --- releases are separated per product ---
  const up = (product, name, bytes) => call("POST", `/api/admin/releases/upload?${product ? "product=" + product + "&" : ""}fileName=${name}`, { raw: bytes, cookie: admin });
  const csBytes = Buffer.from("CS2-LOADER-BYTES");
  const caBytes = Buffer.from("CABR-PAYLOAD-BYTES-v1");
  const u1 = await up("", "cs2.zip", csBytes);
  const u2 = await up("combatarms", "cbr.exe", caBytes);
  const u3 = await up("combatarms-loader", "CaBrLoader.exe", Buffer.from("LOADER-1.0"));
  const u4 = await up("combatarms-loader", "CaBrLoader.exe", Buffer.from("LOADER-1.1"));
  check([u1, u2, u3, u4].every((u) => u.status === 201), "upload releases for cs2, combatarms, combatarms-loader x2", [u1, u2, u3, u4].map((u) => u.status).join());
  const lat = async (p) => (await call("GET", "/api/loader/latest", { headers: p ? { "x-product": p } : {} })).data?.version;
  check((await lat("")) === "1.0" && (await lat("combatarms")) === "1.0" && (await lat("combatarms-loader")) === "1.1",
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
  const rel = await call("GET", "/api/client/release", { headers: authA });
  check(rel.status === 200 && rel.data.release.version === "1.0" && rel.data.release.sha256 === sha(caBytes), "licensed user gets combatarms release metadata");
  const dl = await call("GET", "/api/client/download-loader", { headers: authA });
  check(dl.status === 200 && dl.buf.equals(caBytes) && dl.headers.get("x-content-sha256") === sha(caBytes), "download returns combatarms payload bytes + SHA header");
  const dlLoader = await call("GET", "/api/client/download-loader", { headers: { ...authA, "x-product": "combatarms-loader" } });
  check(dlLoader.status === 200 && dlLoader.buf.toString() === "LOADER-1.1", "loader channel serves the active loader build");
  const dlNoDev = await call("GET", "/api/client/download-loader", { headers: { authorization: "Bearer " + tokenA, "x-product": "combatarms" } });
  check(dlNoDev.status === 401, "download without device header -> 401");

  // cross-product isolation: a CS2-only customer can't pull the Combat Arms build
  const lc = await login("cabr_c", H1.replace(/a/g, "c"), "combatarms");
  const authC = { authorization: "Bearer " + lc.data.token, "x-device-id": "c".repeat(64), "x-product": "combatarms" };
  check(lc.data?.account?.product?.hasAccess === false, "CS2-only customer has no combatarms access");
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

  // --- checkout error handling (Mercado Pago not configured, terms) ---
  const payBody = { product: "combatarms", planKey: "d30", method: "pix", termsAccepted: true, termsVersion: TERMS_VERSION };
  const noTerms = await call("POST", "/api/checkout/payment", { cookie: B.cookie, json: { ...payBody, termsAccepted: false } });
  check(noTerms.status === 400 && noTerms.data?.error === "terms_required", "checkout requires accepted terms");
  const noAuth = await call("POST", "/api/checkout/payment", { json: payBody });
  check(noAuth.status === 401, "checkout requires a logged-in site account", String(noAuth.status));
  const unconf = await call("POST", "/api/checkout/payment", { cookie: B.cookie, json: payBody });
  // 127.0.0.1 is not a BR visitor, so the server may route to Stripe; either way no provider is configured here.
  check(unconf.status === 503 && ["checkout_not_configured", "stripe_not_configured"].includes(unconf.data?.error), "checkout without provider credentials fails safely (503), nothing charged", JSON.stringify(unconf.data));
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
