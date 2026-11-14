// Platform checks against an in-memory Postgres (PGlite): product registry, per-product channels, CI-signed releases
// (attestations), compatibility metadata, disable/rollback, strict publish, license states, adding a product without
// touching the core. No real payments. Needs: npm i --no-save @electric-sql/pglite-socket   (dev only)
// Run: node platform.integration.test.mjs
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import pg from "pg";
import { verifySignature } from "./releaseManifest.js";
import { buildAttestation, signPayload } from "./tools/make-attestation.mjs";

const DB_PORT = 54330, WEB_PORT = 3998, BASE = `http://127.0.0.1:${WEB_PORT}`;
const DB_URL = `postgres://postgres:postgres@127.0.0.1:${DB_PORT}/postgres`;
let fails = 0;
const check = (ok, name, detail = "") => { if (!ok) fails++; console.log((ok ? "ok   " : "FAIL ") + name + (ok ? "" : " :: " + detail)); };

const keys = () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  return { priv: privateKey.export({ type: "pkcs8", format: "pem" }).toString(), pub: publicKey.export({ type: "spki", format: "pem" }).toString() };
};
const CI = keys(), OTHER = keys();

const db = await PGlite.create();
const dbServer = new PGLiteSocketServer({ db, port: DB_PORT, host: "127.0.0.1", maxConnections: 20 });
await dbServer.start();

let web;
const startWeb = async (extraEnv = {}) => {
  web = spawn(process.execPath, ["server.js"], {
    env: { ...process.env, DATABASE_URL: DB_URL, PORT: String(WEB_PORT), SESSION_SECRET: "test-secret-0123456789", ADMIN_PASSWORD: "admin-test-pass",
           PUBLIC_URL: BASE, MP_PUBLIC_KEY: "", MP_ACCESS_TOKEN: "", MP_WEBHOOK_SECRET: "", RELEASE_PUBLIC_KEY: CI.pub, ...extraEnv },
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

  // unsigned upload (loader channels, legacy flow)
  const up = (product, name, bytes) => call("POST", `/api/admin/releases/upload?${product ? "product=" + product + "&" : ""}fileName=${name}`, { raw: bytes, cookie: admin });
  // signed upload exactly as a product's CI does it
  const CONFIGS = {
    combatarms: { fileName: "cbr.exe", launch: { type: "external-exe", requiresAdmin: true }, compat: { minLoader: "1.21", gameBuild: "VER_BR_15.3" } },
    "cs2-payload": { fileName: "LegitBaratinhoCS2.exe", launch: { type: "external-exe", requiresAdmin: false }, compat: { minLoader: "1.21" } },
  };
  const attest = (channel, bytes, version, over = {}, key = CI.priv) => {
    const payload = JSON.stringify({ ...buildAttestation({ product: channel === "cs2-payload" ? "cs2" : channel, version, fileBytes: bytes, config: { ...CONFIGS[channel] }, commit: "abc123", repo: "o/r" }), ...over });
    return { payload, signature: signPayload(payload, key) };
  };
  const upSigned = (channel, bytes, version, { over, key, drop } = {}) => {
    const a = attest(channel, bytes, version, over, key);
    const headers = { "x-product": channel, "x-release-attestation": Buffer.from(a.payload).toString("base64"), "x-release-signature": a.signature };
    if (drop) delete headers[drop];
    return fetch(`${BASE}/api/admin/releases/upload?fileName=${CONFIGS[channel].fileName}&notes=test`, { method: "POST", headers: { ...headers, cookie: admin, "content-type": "application/octet-stream" }, body: bytes })
      .then(async (r) => ({ status: r.status, data: await r.json().catch(() => null) }));
  };

  // --- publish rules ---
  check((await up("nope", "x.exe", pe("a"))).data?.error === "product_required", "unknown product named -> 400 product_required (typo never lands in cs2)");
  const legacy = await up("", "legit.exe", pe("LOADER-LEGACY"));
  check(legacy.status === 201 && legacy.data.signed === false, "request naming no product keeps the historical cs2 loader channel (existing loader publish workflow)", JSON.stringify(legacy.data));
  const a0 = attest("combatarms", pe("x"), "1.0.0");
  check((await fetch(`${BASE}/api/admin/releases/upload?fileName=cbr.exe`, { method: "POST", headers: { cookie: admin, "content-type": "application/octet-stream", "x-release-attestation": Buffer.from(a0.payload).toString("base64"), "x-release-signature": a0.signature }, body: pe("x") })).status === 400,
    "signed upload without a product is refused");
  const notPe = await up("combatarms-loader", "CaBrLoader.exe", Buffer.from("this is not an executable, long enough to pass any size check........"));
  check(notPe.status === 422 && notPe.data.errors.includes("not_a_pe_executable"), "non-PE .exe rejected");
  check((await up("combatarms-loader", "x.dll", pe("d"))).data?.errors?.[0]?.startsWith("extension_not_allowed"), "extension outside the allowed list rejected");
  const v = await call("POST", "/api/admin/releases/validate?product=combatarms&fileName=cbr.exe", { raw: pe("probe"), cookie: admin });
  check(v.status === 200 && v.data.ok && v.data.sha256 === sha(pe("probe")), "validate dry-run reports sha256/PE");
  check((await call("GET", "/api/admin/releases?product=combatarms", { cookie: admin })).data.releases.length === 0, "validate wrote nothing");

  // --- signatures ---
  const ca1 = pe("CABR-1");
  check((await up("combatarms", "cbr.exe", ca1)).data?.error === "signature_required", "signed channel refuses an unsigned upload");
  check((await upSigned("combatarms", ca1, "1.0.0", { key: OTHER.priv })).data?.error === "bad_signature", "attestation signed by another key refused");
  check((await upSigned("combatarms", ca1, "1.0.0", { over: { product: "cs2" } })).data?.error === "attestation_wrong_product", "attestation for another product refused");
  check((await upSigned("combatarms", ca1, "1.0.0", { over: { sha256: sha(pe("other")) } })).data?.error === "attestation_file_mismatch", "attestation for other bytes refused");
  check((await upSigned("combatarms", ca1, "latest")).data?.error === "bad_version", "malformed version refused");
  check((await upSigned("combatarms", ca1, "1.0.0", { drop: "x-release-signature" })).data?.error === "signature_required", "missing signature header refused");
  const p1 = await upSigned("combatarms", ca1, "1.0.0");
  check(p1.status === 201 && p1.data.signed === true && p1.data.release.version === "1.0.0", "signed release accepted; version comes from the attestation", JSON.stringify(p1.data));
  check((await upSigned("combatarms", pe("CABR-DUP"), "1.0.0")).data?.error === "version_exists", "duplicate version in a channel refused");
  const wrong = await up("cs2", "cbr.exe", ca1);
  check(wrong.status === 409 && wrong.data.error === "wrong_channel", "same bytes into another product's channel -> 409 wrong_channel");

  // --- accounts + licenses ---
  const reg = async (n) => { const r = await call("POST", "/api/account/register", { json: { username: n, email: n + "@example.test", password: "Senha-Teste-123" } }); return r.data?.user?.id ?? r.data?.account?.user?.id; };
  const uid = await reg("plat_a");
  const grant = (product, days = 30) => call("POST", `/api/admin/clients/${uid}/add-days`, { cookie: admin, headers: { "x-product": product }, json: { days, plan: "admin" } });
  check((await grant("combatarms")).status === 200 && (await grant("cs2")).status === 200, "grant combatarms + cs2");
  const HW = "c".repeat(64);
  const login = await call("POST", "/api/client/login", { json: { identifier: "plat_a", password: "Senha-Teste-123", hwid: HW }, headers: { "x-product": "cs2" } });
  const auth = (product) => ({ authorization: "Bearer " + login.data.token, "x-device-id": HW, "x-product": product });
  const catalog = async () => Object.fromEntries(((await call("GET", "/api/client/catalog", { headers: auth("cs2") })).data?.products || []).map((p) => [p.code, p]));

  let cat = await catalog();
  check(cat.combatarms?.canLaunch && cat.combatarms.release?.version === "1.0.0" && cat.combatarms.release.signed && cat.combatarms.release.minLoader === "1.21" && cat.combatarms.release.gameBuild === "VER_BR_15.3",
    "catalog: combatarms signed release with compatibility metadata", JSON.stringify(cat.combatarms));
  check(!("combatarms-loader" in cat) && !("cs2-payload" in cat), "catalog hides channels");
  check(cat.cs2?.launch.type === "in-process" && cat.cs2.canLaunch && cat.cs2.release === null, "cs2 without a payload: embedded launch, still launchable");
  check(cat.combatarms.glyph === "CA" && cat.combatarms.name === "Combat Arms Brasil Server" && cat.combatarms.notice?.includes("administrador"), "catalog carries the product display name, glyph and notice");

  // --- manifest (CI attestation) ---
  const pub = (await call("GET", "/api/admin/release-trust", { cookie: admin })).data;
  check(pub?.publicKeyPem?.includes("BEGIN PUBLIC KEY") && pub.fingerprint?.length === 64, "release-trust endpoint exposes only the public key");
  const mf = await call("GET", "/api/client/manifest", { headers: auth("combatarms") });
  const att = mf.data?.payload ? JSON.parse(mf.data.payload) : null;
  check(mf.status === 200 && verifySignature(mf.data.payload, mf.data.signature, CI.pub), "manifest serves the CI attestation; signature verifies with the public key");
  check(att?.product === "combatarms" && att.sha256 === sha(ca1) && att.launch.requiresAdmin === true && att.compat.minLoader === "1.21", "attestation carries product, hash, launch rule and compatibility");
  check(!verifySignature(mf.data.payload.replace("combatarms", "cs2"), mf.data.signature, CI.pub), "tampered attestation fails verification");
  check((await call("GET", "/api/client/manifest", { headers: { ...auth("combatarms"), "x-product": "nope" } })).status === 400, "manifest for unknown product -> 400");
  const dl = await call("GET", "/api/client/payload", { headers: auth("combatarms") });
  check(dl.status === 200 && dl.buf.equals(ca1) && dl.headers.get("x-content-sha256") === sha(ca1), "payload download matches the attested hash");

  // --- cs2: loader channel vs payload channel ---
  const csLoader = Buffer.concat([Buffer.from("PK"), Buffer.alloc(8), Buffer.from("CS2-LOADER-1")]);
  check((await up("cs2", "cs2.zip", csLoader)).status === 201, "publish loader file into the cs2 channel (unsigned, as today)");
  const loaderBefore = (await call("GET", "/api/loader/latest")).data;
  const pay1 = pe("CS2PAY-1"), pay2 = pe("CS2PAY-2");
  check((await upSigned("cs2-payload", pay1, "1.0.0")).status === 201, "publish signed CS2 payload 1.0.0 (cs2-payload)");
  check((await up("cs2-payload", "LegitBaratinhoCS2.exe", pe("UNSIGNED"))).data?.error === "signature_required", "payload channel refuses unsigned files");
  cat = await catalog();
  check(cat.cs2.launch.type === "external-exe" && cat.cs2.release?.version === "1.0.0" && cat.cs2.canLaunch, "cs2 switches to the standalone payload as soon as a signed one is active (no deploy)", JSON.stringify(cat.cs2));
  const csm = JSON.parse((await call("GET", "/api/client/manifest", { headers: auth("cs2") })).data.payload);
  check(csm.product === "cs2" && csm.sha256 === sha(pay1) && csm.fileName === "LegitBaratinhoCS2.exe", "cs2 manifest is built from the payload channel");
  const loaderNow = (await call("GET", "/api/loader/latest")).data;
  check(loaderNow.sha256 === loaderBefore.sha256 && loaderNow.version === loaderBefore.version, "deployed loaders still see their own file on /api/loader/latest");
  check((await call("GET", "/api/client/download-loader", { headers: auth("cs2") })).buf.equals(csLoader), "download-loader (self-update path) still serves the loader file");

  // --- independent updates, rollback, disable ---
  check((await upSigned("cs2-payload", pay2, "1.1.0")).status === 201, "publish CS2 payload 1.1.0");
  const caAfter = JSON.parse((await call("GET", "/api/client/manifest", { headers: auth("combatarms") })).data.payload);
  check(JSON.parse((await call("GET", "/api/client/manifest", { headers: auth("cs2") })).data.payload).version === "1.1.0" && caAfter.version === "1.0.0" && caAfter.sha256 === sha(ca1), "payload update leaves combatarms untouched");
  const rel = (await call("GET", "/api/admin/releases?product=cs2-payload", { cookie: admin })).data.releases;
  const r10 = rel.find((r) => r.version === "1.0.0"), r11 = rel.find((r) => r.version === "1.1.0");
  check(r10.signed && r11.isActive, "admin list shows signature state and the active release");
  check((await call("POST", `/api/admin/releases/${r10.id}/activate`, { cookie: admin })).status === 200 &&
        JSON.parse((await call("GET", "/api/client/manifest", { headers: auth("cs2") })).data.payload).version === "1.0.0", "rollback: activating 1.0.0 serves 1.0.0");
  await call("POST", `/api/admin/releases/${r11.id}/activate`, { cookie: admin });
  const dis = await call("POST", `/api/admin/releases/${r11.id}/disable`, { cookie: admin });
  check(dis.status === 200 && dis.data.fallback?.version === "1.0.0", "disabling the active release promotes the newest enabled one", JSON.stringify(dis.data));
  check(JSON.parse((await call("GET", "/api/client/manifest", { headers: auth("cs2") })).data.payload).version === "1.0.0", "disabled release is no longer served");
  check((await call("POST", `/api/admin/releases/${r11.id}/activate`, { cookie: admin })).data?.error === "release_disabled", "a disabled release cannot be activated");
  check((await call("POST", `/api/admin/releases/${r10.id}/disable`, { cookie: admin })).data.fallback === null, "disabling the last enabled release leaves the channel empty");
  cat = await catalog();
  check(cat.cs2.launch.type === "in-process" && cat.cs2.canLaunch && cat.cs2.release === null, "with every payload disabled cs2 falls back to the embedded launch");
  check((await call("GET", "/api/client/manifest", { headers: auth("cs2") })).status === 404, "no manifest while the channel is empty");
  await call("POST", `/api/admin/releases/${r10.id}/enable`, { cookie: admin });
  check((await call("POST", `/api/admin/releases/${r10.id}/activate`, { cookie: admin })).status === 200 && (await catalog()).cs2.launch.type === "external-exe", "enable + activate restores the payload launch");

  // --- unsigned release is never served as a manifest ---
  check((await up("combatarms-loader", "CaBrLoader.exe", pe("LOADER-1"))).status === 201, "unsigned file into combatarms-loader (loader channel)");
  check((await call("GET", "/api/client/manifest", { headers: auth("combatarms-loader") })).data?.error === "release_unsigned", "a release without attestation is never served as a manifest");

  const sql = new pg.Client({ connectionString: DB_URL }); await sql.connect();
  const ev = (await sql.query("SELECT event, product_code FROM release_events ORDER BY id")).rows.map((r) => r.event + ":" + r.product_code);
  check(["publish:cs2-payload", "activate:cs2-payload", "disable:cs2-payload", "enable:cs2-payload"].every((e) => ev.includes(e)), "publish, rollback, disable, enable are audited", ev.join());

  // --- new product without touching the core ---
  const def = { name: "Jogo Teste", launch: { type: "external-exe", fileName: "teste.exe", requiresAdmin: false }, allowedExtensions: [".exe"], dependencies: ["cs2"], requireSignature: false };
  const reg1 = await call("POST", "/api/admin/products", { cookie: admin, json: { code: "testgame", definition: def } });
  check(reg1.status === 201, "admin registers a new product", JSON.stringify(reg1.data));
  check((await call("POST", "/api/admin/products", { cookie: admin, json: { code: "testgame", definition: def } })).status === 400, "existing product cannot be overwritten");
  check((await call("POST", "/api/admin/products", { cookie: admin, json: { code: "bad", definition: { ...def, dependencies: ["missing"] } } })).status === 400, "unknown dependency rejected");
  check((await up("testgame", "teste.exe", pe("TG-1"))).status === 201 && (await grant("testgame")).status === 200, "publish and license for the new product");
  const tg = (await catalog()).testgame;
  check(tg?.canLaunch && tg.release.version === "1.0", "new product appears in the catalog without any loader or core change", JSON.stringify(tg));

  // --- expired license ---
  await sql.query("UPDATE user_products SET expires_at = NOW() - INTERVAL '1 day' WHERE user_id = $1 AND product_code = 'combatarms'", [uid]);
  const ex = (await catalog()).combatarms;
  check(ex.license.status === "expired" && ex.canLaunch === false && ex.release === null, "expired license: listed, not launchable, no release exposed");
  check((await call("GET", "/api/client/manifest", { headers: auth("combatarms") })).status === 403 && (await call("GET", "/api/client/payload", { headers: auth("combatarms") })).status === 403, "expired license: manifest and download refused");
  await sql.end();

  // --- persistence + missing trust anchor ---
  await stopWeb(); await startWeb({ RELEASE_PUBLIC_KEY: "" }) /* falls back to the built-in production public key */;
  const admin2 = cookieOf(await call("POST", "/api/admin/login", { json: { password: "admin-test-pass" } }), "lb_admin");
  check((await call("GET", "/api/admin/products", { cookie: admin2 })).data.products.some((p) => p.code === "testgame"), "registered product survives a restart");
  const a2 = attest("combatarms", pe("CABR-2"), "1.1.0");
  const noTrust = await fetch(`${BASE}/api/admin/releases/upload?fileName=cbr.exe`, { method: "POST", headers: { cookie: admin2, "content-type": "application/octet-stream", "x-product": "combatarms", "x-release-attestation": Buffer.from(a2.payload).toString("base64"), "x-release-signature": a2.signature }, body: pe("CABR-2") });
  check(noTrust.status === 422 && (await noTrust.json()).error === "bad_signature", "without the test override the built-in production key applies: a release signed by another key is refused");

  exitCode = fails ? 1 : 0;
  console.log(fails ? `PLATFORM: ${fails} FAILED` : "PLATFORM: ALL PASSED");
} catch (e) {
  console.error("harness error:", e);
} finally {
  try { web?.kill(); } catch {}
  await dbServer.stop().catch(() => {}); await db.close().catch(() => {});
  process.exit(exitCode);
}
