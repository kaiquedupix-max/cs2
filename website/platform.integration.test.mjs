// Platform checks against an in-memory Postgres (PGlite): product registry, per-product releases, signed manifests,
// strict publish, license states and adding a product without touching the core. No real payments.
// Needs: npm i --no-save @electric-sql/pglite-socket   (dev only)      Run: node platform.integration.test.mjs
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import pg from "pg";
import { verifyManifest } from "./releaseManifest.js";

const DB_PORT = 54330, WEB_PORT = 3998, BASE = `http://127.0.0.1:${WEB_PORT}`;
const DB_URL = `postgres://postgres:postgres@127.0.0.1:${DB_PORT}/postgres`;
let fails = 0;
const check = (ok, name, detail = "") => { if (!ok) fails++; console.log((ok ? "ok   " : "FAIL ") + name + (ok ? "" : " :: " + detail)); };

const { privateKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const SIGNING_KEY = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

const db = await PGlite.create();
const dbServer = new PGLiteSocketServer({ db, port: DB_PORT, host: "127.0.0.1", maxConnections: 20 });
await dbServer.start();

let web;
const startWeb = async (extraEnv = {}) => {
  web = spawn(process.execPath, ["server.js"], {
    env: { ...process.env, DATABASE_URL: DB_URL, PORT: String(WEB_PORT), SESSION_SECRET: "test-secret-0123456789", ADMIN_PASSWORD: "admin-test-pass",
           PUBLIC_URL: BASE, MP_PUBLIC_KEY: "", MP_ACCESS_TOKEN: "", MP_WEBHOOK_SECRET: "", RELEASE_SIGNING_KEY: SIGNING_KEY, ...extraEnv },
    stdio: ["ignore", "ignore", "ignore"],
  });
  for (let i = 0; i < 150; i++) { try { if ((await fetch(BASE + "/health")).ok) return; } catch {} await new Promise((r) => setTimeout(r, 200)); }
  throw new Error("server did not start");
};
const stopWeb = async () => { web.kill(); await new Promise((r) => web.once("exit", r)); };

async function call(method, path, { headers = {}, json, raw, cookie } = {}) {
  const h = { ...headers };
  if (cookie) h.cookie = cookie;
  let body;
  if (json !== undefined) { h["content-type"] = "application/json"; body = JSON.stringify(json); }
  if (raw !== undefined) { h["content-type"] = "application/octet-stream"; body = raw; }
  const res = await fetch(BASE + path, { method, headers: h, body });
  const buf = Buffer.from(await res.arrayBuffer());
  let data = null; try { data = JSON.parse(buf.toString("utf8")); } catch {}
  return { status: res.status, data, buf, headers: res.headers };
}
const cookieOf = (r, name) => (r.headers.getSetCookie?.() || []).map((c) => c.split(";")[0]).find((c) => c.startsWith(name + "="));
const pe = (tag) => Buffer.concat([Buffer.from("MZ"), Buffer.alloc(0x40), Buffer.from(tag)]);
const sha = (b) => crypto.createHash("sha256").update(b).digest("hex");

let exitCode = 1;
try {
  await startWeb();
  const admin = cookieOf(await call("POST", "/api/admin/login", { json: { password: "admin-test-pass" } }), "lb_admin");
  const up = (product, name, bytes) => call("POST", `/api/admin/releases/upload?${product ? "product=" + product + "&" : ""}fileName=${name}`, { raw: bytes, cookie: admin });

  // --- strict publish ---
  check((await up("", "x.exe", pe("a"))).status === 400, "publish without product -> 400 (no silent CS2 default)");
  check((await up("nope", "x.exe", pe("a"))).data?.error === "product_required", "publish to unknown product -> product_required");
  const notPe = await up("combatarms", "cbr.exe", Buffer.from("this is not an executable, long enough to pass any size check........"));
  check(notPe.status === 422 && notPe.data.errors.includes("not_a_pe_executable"), "non-PE .exe rejected", JSON.stringify(notPe.data));
  check((await up("combatarms", "cbr.dll", pe("d"))).data?.errors?.[0]?.startsWith("extension_not_allowed"), "extension outside the product's allowed list rejected");
  const v = await call("POST", "/api/admin/releases/validate?product=combatarms&fileName=cbr.exe", { raw: pe("probe"), cookie: admin });
  check(v.status === 200 && v.data.ok && v.data.sha256 === sha(pe("probe")) && v.data.isPe, "validate dry-run reports sha256/PE", JSON.stringify(v.data));
  check((await call("GET", "/api/admin/releases?product=combatarms", { cookie: admin })).data.releases.length === 0, "validate wrote nothing");

  // --- releases: independent channels, wrong-channel guard, rollback ---
  const ca1 = pe("CABR-1"), cs1 = Buffer.concat([Buffer.from("PK"), Buffer.alloc(8), Buffer.from("CS2-1")]);
  check((await up("combatarms", "cbr.exe", ca1)).status === 201, "publish combatarms 1.0");
  check((await up("cs2", "cs2.zip", cs1)).status === 201, "publish cs2 1.0");
  const wrong = await up("cs2", "cbr.exe", ca1);
  check(wrong.status === 409 && wrong.data.error === "wrong_channel", "same bytes into another product's channel -> 409 wrong_channel", JSON.stringify(wrong.data));

  // --- accounts + licenses ---
  const reg = async (n) => { const r = await call("POST", "/api/account/register", { json: { username: n, email: n + "@example.test", password: "Senha-Teste-123" } }); return r.data?.user?.id ?? r.data?.account?.user?.id; };
  const uid = await reg("plat_a");
  const grant = (product, days = 30) => call("POST", `/api/admin/clients/${uid}/add-days`, { cookie: admin, headers: { "x-product": product }, json: { days, plan: "admin" } });
  check((await grant("combatarms")).status === 200 && (await grant("cs2")).status === 200, "grant combatarms + cs2");
  const HW = "c".repeat(64);
  const login = await call("POST", "/api/client/login", { json: { identifier: "plat_a", password: "Senha-Teste-123", hwid: HW }, headers: { "x-product": "cs2" } });
  const auth = (product) => ({ authorization: "Bearer " + login.data.token, "x-device-id": HW, "x-product": product });
  check(login.status === 200, "loader login");

  const cat = await call("GET", "/api/client/catalog", { headers: auth("cs2") });
  const byCode = Object.fromEntries((cat.data?.products || []).map((p) => [p.code, p]));
  check(cat.status === 200 && byCode.cs2?.canLaunch && byCode.combatarms?.canLaunch && byCode.combatarms.release?.version === "1.0" && byCode.combatarms.license.status === "active",
    "catalog: owned products with license + release + canLaunch", JSON.stringify(cat.data));
  check(!("combatarms-loader" in byCode), "catalog hides loader channels");
  check(byCode.combatarms?.glyph === "CA" && byCode.combatarms.notice?.includes("administrador") && byCode.cs2?.launch.type === "in-process" && byCode.combatarms.launch.type === "external-exe", "catalog carries glyph, notice and launch type for the UI", JSON.stringify(byCode.combatarms));

  // --- signed manifest ---
  const pubPem = (await call("GET", "/api/admin/signing-key", { cookie: admin })).data?.publicKeyPem;
  const mf = await call("GET", "/api/client/manifest", { headers: auth("combatarms") });
  const parsed = mf.data?.payload ? JSON.parse(mf.data.payload) : null;
  check(mf.status === 200 && verifyManifest(mf.data.payload, mf.data.signature, pubPem), "manifest signature verifies with the published public key", JSON.stringify(mf.data));
  check(parsed?.product === "combatarms" && parsed.files[0].sha256 === sha(ca1) && parsed.launch.requiresAdmin === true, "manifest carries product, file hash, launch rule");
  check(!verifyManifest(mf.data.payload.replace("combatarms", "cs2"), mf.data.signature, pubPem), "tampered manifest fails verification");
  check((await call("GET", "/api/client/manifest", { headers: { ...auth("combatarms"), "x-product": "nope" } })).status === 400, "manifest for unknown product -> 400");

  // --- independent updates: the cs2 channel is the loader's self-update; the CS2 payload has its own channel ---
  const pay = (tag) => pe("CS2PAY-" + tag);
  check((await up("cs2-payload", "LegitBaratinhoCS2.exe", pay("1"))).status === 201, "publish CS2 payload 1.0 (channel cs2-payload)");
  const loaderBefore = (await call("GET", "/api/loader/latest")).data;
  const csBefore = JSON.parse((await call("GET", "/api/client/manifest", { headers: auth("cs2") })).data.payload);
  check(csBefore.product === "cs2" && csBefore.version === "1.0" && csBefore.files[0].sha256 === sha(pay("1")) && csBefore.files[0].name === "LegitBaratinhoCS2.exe",
    "cs2 manifest is built from the payload channel, not from the loader file", JSON.stringify(csBefore.files));
  check(loaderBefore?.sha256 === sha(cs1), "deployed loaders still see the loader file on /api/loader/latest (self-update untouched)");
  check((await up("cs2-payload", "LegitBaratinhoCS2.exe", pay("2"))).status === 201, "publish CS2 payload 1.1");
  const csAfter = JSON.parse((await call("GET", "/api/client/manifest", { headers: auth("cs2") })).data.payload);
  const caAfter = JSON.parse((await call("GET", "/api/client/manifest", { headers: auth("combatarms") })).data.payload);
  const loaderAfter = (await call("GET", "/api/loader/latest")).data;
  check(csAfter.version === "1.1" && caAfter.version === "1.0" && caAfter.files[0].sha256 === sha(ca1), "cs2 payload update leaves combatarms untouched");
  check(loaderAfter.version === loaderBefore.version && loaderAfter.sha256 === loaderBefore.sha256, "cs2 payload update leaves the loader channel untouched");
  const dlPayload = await call("GET", "/api/client/payload", { headers: auth("cs2") });
  check(dlPayload.status === 200 && dlPayload.buf.equals(pay("2")) && dlPayload.headers.get("x-content-sha256") === sha(pay("2")), "/api/client/payload serves the active payload of the release channel");
  const dlLoaderFile = await call("GET", "/api/client/download-loader", { headers: auth("cs2") });
  check(dlLoaderFile.status === 200 && dlLoaderFile.buf.equals(cs1), "download-loader (self-update path) still serves the loader file");
  check((await call("GET", "/api/client/payload", { headers: { ...auth("cs2"), "x-product": "nope" } })).status === 400, "payload for unknown product -> 400");
  const rel = (await call("GET", "/api/admin/releases?product=cs2-payload", { cookie: admin })).data.releases;
  const old = rel.find((r) => r.version === "1.0");
  check((await call("POST", `/api/admin/releases/${old.id}/activate`, { cookie: admin })).status === 200, "rollback CS2 payload to 1.0");
  check(JSON.parse((await call("GET", "/api/client/manifest", { headers: auth("cs2") })).data.payload).version === "1.0", "manifest follows the rollback");
  check((await call("GET", "/api/client/catalog", { headers: auth("cs2") })).data.products.find((p) => p.code === "cs2").release.version === "1.0", "catalog shows the payload version for cs2");
  const sql = new pg.Client({ connectionString: DB_URL }); await sql.connect();
  const ev = (await sql.query("SELECT event, product_code FROM release_events ORDER BY id")).rows.map((r) => r.event + ":" + r.product_code);
  check(ev.includes("publish:cs2-payload") && ev.includes("activate:cs2-payload"), "publish and rollback are audited", ev.join());

  // --- new product without touching the core ---
  const def = { name: "Jogo Teste", launch: { type: "external-exe", fileName: "teste.exe", requiresAdmin: false }, allowedExtensions: [".exe"], dependencies: ["cs2"] };
  const reg1 = await call("POST", "/api/admin/products", { cookie: admin, json: { code: "testgame", definition: def } });
  check(reg1.status === 201, "admin registers a new product", JSON.stringify(reg1.data));
  check((await call("POST", "/api/admin/products", { cookie: admin, json: { code: "testgame", definition: def } })).status === 400, "existing product cannot be overwritten");
  check((await call("POST", "/api/admin/products", { cookie: admin, json: { code: "bad", definition: { ...def, dependencies: ["missing"] } } })).status === 400, "unknown dependency rejected");
  check((await up("testgame", "teste.exe", pe("TG-1"))).status === 201, "publish to the new product's channel");
  check((await grant("testgame")).status === 200, "license for the new product");
  const cat2 = await call("GET", "/api/client/catalog", { headers: auth("testgame") });
  const tg = cat2.data?.products?.find((p) => p.code === "testgame");
  check(tg?.canLaunch && tg.release.version === "1.0", "new product appears in the catalog and is launchable", JSON.stringify(cat2.data));
  const tgm = JSON.parse((await call("GET", "/api/client/manifest", { headers: auth("testgame") })).data.payload);
  check(tgm.product === "testgame" && tgm.dependencies[0] === "cs2", "new product manifest with its dependency");

  // --- expired license ---
  await sql.query("UPDATE user_products SET expires_at = NOW() - INTERVAL '1 day' WHERE user_id = $1 AND product_code = 'combatarms'", [uid]);
  const cat3 = await call("GET", "/api/client/catalog", { headers: auth("cs2") });
  const ex = cat3.data.products.find((p) => p.code === "combatarms");
  check(ex.license.status === "expired" && ex.canLaunch === false && ex.release === null, "expired license: listed, not launchable, no release exposed", JSON.stringify(ex));
  check((await call("GET", "/api/client/manifest", { headers: auth("combatarms") })).status === 403, "expired license: manifest refused");
  check((await call("GET", "/api/client/download-loader", { headers: auth("combatarms") })).status === 403 && (await call("GET", "/api/client/payload", { headers: auth("combatarms") })).status === 403, "expired license: downloads refused");
  await sql.end();

  // --- persistence + missing key ---
  await stopWeb(); await startWeb({ RELEASE_SIGNING_KEY: "" });
  const admin2 = cookieOf(await call("POST", "/api/admin/login", { json: { password: "admin-test-pass" } }), "lb_admin");
  const plist = await call("GET", "/api/admin/products", { cookie: admin2 });
  check(plist.data.products.some((p) => p.code === "testgame"), "registered product survives a restart");
  const login2 = await call("POST", "/api/client/login", { json: { identifier: "plat_a", password: "Senha-Teste-123", hwid: HW }, headers: { "x-product": "cs2" } });
  const noKey = await call("GET", "/api/client/manifest", { headers: { authorization: "Bearer " + login2.data.token, "x-device-id": HW, "x-product": "cs2" } });
  check(noKey.status === 503 && noKey.data.error === "signing_not_configured", "no signing key -> 503, never an unsigned manifest");

  exitCode = fails ? 1 : 0;
  console.log(fails ? `PLATFORM: ${fails} FAILED` : "PLATFORM: ALL PASSED");
} catch (e) {
  console.error("harness error:", e);
} finally {
  try { web?.kill(); } catch {}
  await dbServer.stop().catch(() => {}); await db.close().catch(() => {});
  process.exit(exitCode);
}
