// Release attestation + pre-publish file inspection. Pure functions (no DB, no HTTP).
//
// Trust model: the product's CI signs an attestation (a JSON string) with a private key that only exists in that
// repository's protected secrets. The server never holds a private key: it only checks the signature with the PUBLIC key
// before accepting an upload, stores payload + signature next to the file, and serves them back. The loader verifies the
// same signature with the public key embedded in the loader, so neither a compromised server nor a swapped file can make a
// loader run something CI did not build.
//
// Signature: ECDSA P-256 / SHA-256, DER-encoded, base64 (verifiable with .NET ECDsa.VerifyData, Rfc3279DerSequence).
// The signed bytes are the exact `payload` string; clients verify the string first and parse it afterwards.
import crypto from "node:crypto";

export const ATTESTATION_SCHEMA = 2;
const VERSION_RE = /^\d{1,4}\.\d{1,4}(\.\d{1,4})?$/;

export const isVersion = (v) => VERSION_RE.test(String(v || ""));

// Compares dotted versions numerically (1.10 > 1.9). Missing parts count as 0.
export function compareVersions(a, b) {
  const pa = String(a).split(".").map(Number), pb = String(b).split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const d = (pa[i] || 0) - (pb[i] || 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
}

export function verifySignature(payload, signature, publicKeyPem) {
  try {
    return crypto.verify("sha256", Buffer.from(payload, "utf8"), crypto.createPublicKey(publicKeyPem), Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
}

// Checks an upload's attestation against the key, the target product and the uploaded bytes.
// Returns { ok: true, attestation } or { ok: false, error } with a stable error code.
export function verifyAttestation({ payload, signature, publicKeyPem, product, fileName, size, sha256 }) {
  if (!publicKeyPem) return { ok: false, error: "release_trust_not_configured" };
  if (!payload || !signature) return { ok: false, error: "signature_required" };
  if (!verifySignature(payload, signature, publicKeyPem)) return { ok: false, error: "bad_signature" };
  let a;
  try { a = JSON.parse(payload); } catch { return { ok: false, error: "bad_attestation" }; }
  if (a?.schema !== ATTESTATION_SCHEMA) return { ok: false, error: "bad_attestation" };
  if (a.product !== product) return { ok: false, error: "attestation_wrong_product" };
  if (!isVersion(a.version)) return { ok: false, error: "bad_version" };
  if (a.fileName !== fileName || Number(a.size) !== size || String(a.sha256).toLowerCase() !== sha256) return { ok: false, error: "attestation_file_mismatch" };
  if (!a.launch || !["external-exe", "in-process"].includes(a.launch.type)) return { ok: false, error: "bad_attestation" };
  if (a.compat?.minLoader !== undefined && !isVersion(a.compat.minLoader)) return { ok: false, error: "bad_attestation" };
  return { ok: true, attestation: a };
}

// Dry-run check shown to the admin before anything is written.
export function inspectUpload(buffer, fileName, def) {
  const errors = [], warnings = [];
  const ext = (/\.[A-Za-z0-9]+$/.exec(fileName || "")?.[0] || "").toLowerCase();
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) errors.push("empty_file");
  if (!def.allowedExtensions.includes(ext)) errors.push("extension_not_allowed:" + (ext || "none"));
  if (def.launch.type === "external-exe" && def.launch.fileName && ext === ".exe" && fileName.toLowerCase() !== def.launch.fileName.toLowerCase()) {
    warnings.push("file_name_differs_from_launch_file:" + def.launch.fileName);
  }
  const isPe = buffer.length > 0x40 && buffer[0] === 0x4d && buffer[1] === 0x5a;
  if (ext === ".exe" && !isPe) errors.push("not_a_pe_executable");
  if (ext === ".zip" && !(buffer.length > 4 && buffer[0] === 0x50 && buffer[1] === 0x4b)) errors.push("not_a_zip_archive");
  return {
    ok: errors.length === 0, errors, warnings, extension: ext, size: buffer.length ?? 0, isPe,
    sha256: crypto.createHash("sha256").update(buffer).digest("hex"),
  };
}
