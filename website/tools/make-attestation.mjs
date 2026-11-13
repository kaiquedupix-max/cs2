// Builds and signs a release attestation (schema 2) for one product file. Used by each product repository's CI and by tests.
//
//   node make-attestation.mjs --file <path> --product <code> --version <x.y[.z]> --config release.json \
//        [--commit <sha>] [--repo <owner/name>] --out <dir>
//
// The private key is read ONLY from the environment variable RELEASE_SIGNING_KEY (PEM, "\n" escapes allowed): in CI this is a
// protected repository secret. Nothing secret is written to disk or printed. Output files in <dir>:
//   attestation.json   the exact signed string        signature.b64   base64 DER ECDSA P-256 signature
// release.json (committed in the product repo): { "fileName": "cbr.exe", "launch": { "type": "external-exe", "requiresAdmin": true },
//   "compat": { "minLoader": "1.21", "gameBuild": "VER_BR_15.3" } }
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export function buildAttestation({ product, version, fileBytes, config, commit = "", repo = "", builtAt = new Date() }) {
  return {
    schema: 2,
    product,
    version,
    fileName: config.fileName,
    size: fileBytes.length,
    sha256: crypto.createHash("sha256").update(fileBytes).digest("hex"),
    launch: { type: config.launch?.type || "external-exe", requiresAdmin: Boolean(config.launch?.requiresAdmin) },
    compat: { ...(config.compat || {}) },
    builtAt: builtAt.toISOString(),
    source: { repo, commit },
  };
}

export function signPayload(payload, privateKeyPem) {
  const key = crypto.createPrivateKey(privateKeyPem);
  if (key.asymmetricKeyType !== "ec" || key.asymmetricKeyDetails?.namedCurve !== "prime256v1") throw new Error("signing key must be an ECDSA P-256 key");
  return crypto.sign("sha256", Buffer.from(payload, "utf8"), key).toString("base64");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const arg = (n) => { const i = process.argv.indexOf("--" + n); return i > 0 ? process.argv[i + 1] : ""; };
  const need = (n) => arg(n) || (() => { throw new Error("missing --" + n); })();
  const pem = (process.env.RELEASE_SIGNING_KEY || "").replace(/\\n/g, "\n").trim();
  if (!pem) throw new Error("RELEASE_SIGNING_KEY is not set");
  const config = JSON.parse(fs.readFileSync(need("config"), "utf8"));
  const file = fs.readFileSync(need("file"));
  if (path.basename(need("file")) !== config.fileName) throw new Error("file name differs from release.json fileName");
  const payload = JSON.stringify(buildAttestation({ product: need("product"), version: need("version"), fileBytes: file, config, commit: arg("commit"), repo: arg("repo") }));
  const out = need("out");
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(path.join(out, "attestation.json"), payload);
  fs.writeFileSync(path.join(out, "signature.b64"), signPayload(payload, pem));
  console.log("attestation written:", JSON.parse(payload).sha256, "v" + JSON.parse(payload).version);
}
