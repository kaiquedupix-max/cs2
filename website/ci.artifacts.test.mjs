// Feeds REAL release artifacts produced by a product's CI (attestation.json, signature.b64, file) into this server using
// the BUILT-IN production public key (no override). Proves the key in releaseTrust.js matches the CI secret.
// Run: LB_CI_ARTIFACTS=<dir with combatarms/ and cs2/> node ci.artifacts.test.mjs
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const dir = process.env.LB_CI_ARTIFACTS;
if (!dir) { console.error("set LB_CI_ARTIFACTS"); process.exit(2); }
const DB_PORT = 54332, WEB_PORT = 3995, BASE = `http://127.0.0.1:${WEB_PORT}`;
let fails = 0;
const check = (ok, name, detail = "") => { if (!ok) fails++; console.log((ok ? "ok   " : "FAIL ") + name + (ok ? "" : " :: " + detail)); };

const db = await PGlite.create();
const dbServer = new PGLiteSocketServer({ db, port: DB_PORT, host: "127.0.0.1", maxConnections: 20 });
await dbServer.start();
const env = { ...process.env, DATABASE_URL: `postgres://postgres:postgres@127.0.0.1:${DB_PORT}/postgres`, PORT: String(WEB_PORT), SESSION_SECRET: "test-secret-0123456789", ADMIN_PASSWORD: "admin-test-pass", PUBLIC_URL: BASE, MP_PUBLIC_KEY: "", MP_ACCESS_TOKEN: "", MP_WEBHOOK_SECRET: "" };
delete env.RELEASE_PUBLIC_KEY;
const web = spawn(process.execPath, ["server.js"], { env, stdio: "ignore" });

let exitCode = 1;
try {
  for (let i = 0; i < 150; i++) { try { if ((await fetch(BASE + "/health")).ok) break; } catch {} await new Promise((r) => setTimeout(r, 200)); }
  const login = await fetch(BASE + "/api/admin/login", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ password: "admin-test-pass" }) });
  const cookie = login.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => c.startsWith("lb_admin="));
  for (const [folder, channel, file] of [["cabr", "combatarms", "cbr.exe"], ["cs2", "cs2-payload", "LegitBaratinhoCS2.exe"]]) {
    const p = path.join(dir, folder);
    const attestation = fs.readFileSync(path.join(p, "attestation.json"));
    const signature = fs.readFileSync(path.join(p, "signature.b64"), "utf8").trim();
    const bytes = fs.readFileSync(path.join(p, file));
    const res = await fetch(`${BASE}/api/admin/releases/upload?fileName=${file}&notes=ci-artifact`, { method: "POST", body: bytes,
      headers: { cookie, "content-type": "application/octet-stream", "x-product": channel, "x-release-attestation": attestation.toString("base64"), "x-release-signature": signature } });
    const data = await res.json().catch(() => null);
    check(res.status === 201 && data?.signed === true && data.release.version === JSON.parse(attestation.toString()).version,
      `${channel}: server accepts the real CI release with its built-in public key`, JSON.stringify(data));
    // a single flipped byte must be refused
    const flipped = Buffer.from(bytes); flipped[flipped.length - 1] ^= 1;
    const bad = await fetch(`${BASE}/api/admin/releases/upload?fileName=${file}`, { method: "POST", body: flipped,
      headers: { cookie, "content-type": "application/octet-stream", "x-product": channel, "x-release-attestation": attestation.toString("base64"), "x-release-signature": signature } });
    check(bad.status === 422, `${channel}: the same attestation with one byte changed is refused`, String(bad.status));
  }
  exitCode = fails ? 1 : 0;
  console.log(fails ? `CI ARTIFACTS: ${fails} FAILED` : "CI ARTIFACTS: ALL PASSED");
} catch (e) { console.error("harness error:", e); }
finally { try { web.kill(); } catch {} await dbServer.stop().catch(() => {}); await db.close().catch(() => {}); process.exit(exitCode); }
