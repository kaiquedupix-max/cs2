// End-to-end: the REAL loader client code (ClientPortalApi, PortalReleaseSource, ProductSession from the loader repository)
// against THIS server on an in-memory Postgres, with releases signed the way product CI signs them. No production access.
// Run: LB_LOADER_DIR=<path to the loader checkout> node e2e.loader.test.mjs
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { spawn } from "node:child_process";
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import pg from "pg";
import { buildAttestation, signPayload } from "./tools/make-attestation.mjs";

const LOADER_DIR = process.env.LB_LOADER_DIR;
if (!LOADER_DIR || !fs.existsSync(path.join(LOADER_DIR, "Tests", "E2E", "E2E.csproj"))) { console.error("set LB_LOADER_DIR to the loader checkout"); process.exit(2); }

const DB_PORT = 54331, WEB_PORT = 3997, BASE = `http://127.0.0.1:${WEB_PORT}`;
const DB_URL = `postgres://postgres:postgres@127.0.0.1:${DB_PORT}/postgres`;
const keyPair = () => {
  const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
  return { priv: privateKey.export({ type: "pkcs8", format: "pem" }).toString(), pubPem: publicKey.export({ type: "spki", format: "pem" }).toString(), pubB64: publicKey.export({ type: "spki", format: "der" }).toString("base64") };
};
const CI = keyPair(), OTHER = keyPair();

const db = await PGlite.create();
const dbServer = new PGLiteSocketServer({ db, port: DB_PORT, host: "127.0.0.1", maxConnections: 20 });
await dbServer.start();
const web = spawn(process.execPath, ["server.js"], {
  env: { ...process.env, DATABASE_URL: DB_URL, PORT: String(WEB_PORT), SESSION_SECRET: "test-secret-0123456789", ADMIN_PASSWORD: "admin-test-pass",
         PUBLIC_URL: BASE, MP_PUBLIC_KEY: "", MP_ACCESS_TOKEN: "", MP_WEBHOOK_SECRET: "", RELEASE_PUBLIC_KEY: CI.pubPem },
  stdio: ["ignore", "ignore", "ignore"],
});

let exitCode = 1;
try {
  for (let i = 0; i < 150; i++) { try { if ((await fetch(BASE + "/health")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 200)); }
  const call = async (method, p, { json, headers = {}, cookie } = {}) => {
    const res = await fetch(BASE + p, { method, headers: { ...(json ? { "content-type": "application/json" } : {}), ...(cookie ? { cookie } : {}), ...headers }, body: json ? JSON.stringify(json) : undefined });
    return { status: res.status, headers: res.headers, data: await res.json().catch(() => null) };
  };
  const adminLogin = await call("POST", "/api/admin/login", { json: { password: "admin-test-pass" } });
  const admin = adminLogin.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("lb_admin="));

  // a real, runnable, harmless executable: a copy of whoami.exe (the second one gets one extra overlay byte so the two hashes differ)
  const whoami = fs.readFileSync(path.join(process.env.SystemRoot || "C:\\Windows", "System32", "whoami.exe"));
  const publish = async (channel, product, fileName, bytes, version) => {
    const payload = JSON.stringify(buildAttestation({ product, version, fileBytes: bytes, config: { fileName, launch: { type: "external-exe", requiresAdmin: false }, compat: { minLoader: "1.21", gameBuild: "TEST" } }, commit: "e2e", repo: "test/test" }));
    const res = await fetch(`${BASE}/api/admin/releases/upload?fileName=${fileName}`, { method: "POST", body: bytes,
      headers: { cookie: admin, "content-type": "application/octet-stream", "x-product": channel, "x-release-attestation": Buffer.from(payload).toString("base64"), "x-release-signature": signPayload(payload, CI.priv) } });
    if (res.status !== 201) throw new Error(`publish ${channel} failed: ${res.status} ${await res.text()}`);
  };
  await publish("combatarms", "combatarms", "cbr.exe", whoami, "1.0.0");
  await publish("cs2-payload", "cs2", "LegitBaratinhoCS2.exe", Buffer.concat([whoami, Buffer.from([0])]), "1.0.0");
  const def = { name: "Jogo Teste", launch: { type: "external-exe", fileName: "teste.exe", requiresAdmin: false }, allowedExtensions: [".exe"], requireSignature: false };
  await call("POST", "/api/admin/products", { json: { code: "testgame", definition: def }, cookie: admin });
  await fetch(`${BASE}/api/admin/releases/upload?fileName=teste.exe`, { method: "POST", body: Buffer.concat([whoami, Buffer.from([1])]), headers: { cookie: admin, "content-type": "application/octet-stream", "x-product": "testgame" } });

  const reg = await call("POST", "/api/account/register", { json: { username: "e2e_user", email: "e2e_user@example.test", password: "Senha-Teste-123" } });
  const uid = reg.data?.user?.id ?? reg.data?.account?.user?.id;
  for (const p of ["combatarms", "cs2", "testgame"]) await call("POST", `/api/admin/clients/${uid}/add-days`, { json: { days: 30, plan: "admin" }, headers: { "x-product": p }, cookie: admin });
  const sql = new pg.Client({ connectionString: DB_URL }); await sql.connect();
  await sql.query("UPDATE user_products SET expires_at = NOW() - INTERVAL '1 day' WHERE user_id = $1 AND product_code = 'testgame'", [uid]);
  await sql.end();

  const work = fs.mkdtempSync(path.join(os.tmpdir(), "lb-e2e-"));
  // Asynchronous on purpose: PGlite runs inside this process, so a blocking spawn would freeze the database the server needs.
  const run = await new Promise((resolve) => {
    const child = spawn("dotnet", ["run", "--project", path.join(LOADER_DIR, "Tests", "E2E", "E2E.csproj"), "-c", "Release"], {
      stdio: "inherit",
      env: { ...process.env, LB_PORTAL_URL: BASE + "/", E2E_USER: "e2e_user", E2E_PASS: "Senha-Teste-123", E2E_PUB: CI.pubB64, E2E_WRONG_PUB: OTHER.pubB64, E2E_BASE: work },
    });
    const timer = setTimeout(() => child.kill(), 600000);
    child.on("exit", (code) => { clearTimeout(timer); resolve({ status: code }); });
  });
  fs.rmSync(work, { recursive: true, force: true });
  exitCode = run.status === 0 ? 0 : 1;
  console.log(exitCode === 0 ? "E2E: ALL PASSED" : "E2E: FAILED (exit " + run.status + ")");
} catch (e) {
  console.error("harness error:", e);
} finally {
  try { web.kill(); } catch {}
  await dbServer.stop().catch(() => {}); await db.close().catch(() => {});
  process.exit(exitCode);
}
