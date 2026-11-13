// Signed release manifest + pre-publish file inspection. Pure functions (no DB, no HTTP).
// Signature: ECDSA P-256 / SHA-256, DER-encoded, base64 (verifiable with .NET ECDsa.VerifyData, Rfc3279DerSequence).
// The signed bytes are the exact `payload` string; clients verify the string first and parse it afterwards.
import crypto from "node:crypto";

export const MANIFEST_SCHEMA = 1;

export function buildManifest({ product, def, release, issuedAt = new Date() }) {
  return {
    schema: MANIFEST_SCHEMA,
    product,
    channel: def.channel,
    version: release.version,
    issuedAt: issuedAt.toISOString(),
    launch: { type: def.launch.type, fileName: def.launch.fileName ?? null, requiresAdmin: def.launch.requiresAdmin },
    dependencies: def.dependencies,
    files: [{ name: release.file_name, size: Number(release.file_size), sha256: String(release.sha256).toLowerCase() }],
  };
}

export function signManifest(manifest, privateKeyPem) {
  const payload = JSON.stringify(manifest);
  const key = crypto.createPrivateKey(privateKeyPem);
  if (key.asymmetricKeyType !== "ec" || key.asymmetricKeyDetails?.namedCurve !== "prime256v1") throw new Error("signing_key_must_be_p256");
  const signature = crypto.sign("sha256", Buffer.from(payload, "utf8"), key).toString("base64");
  return { payload, signature };
}

export function verifyManifest(payload, signature, publicKeyPem) {
  try {
    return crypto.verify("sha256", Buffer.from(payload, "utf8"), crypto.createPublicKey(publicKeyPem), Buffer.from(signature, "base64"));
  } catch {
    return false;
  }
}

export function publicKeyOf(privateKeyPem) {
  return crypto.createPublicKey(crypto.createPrivateKey(privateKeyPem)).export({ type: "spki", format: "pem" }).toString();
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
