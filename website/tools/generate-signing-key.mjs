// Generates the release-signing key pair (ECDSA P-256). Prints both halves to stdout; writes nothing to disk.
//   private PEM  -> server secret RELEASE_SIGNING_KEY (never commit it, never paste it in chat)
//   public SPKI  -> Classes/Platform/ReleaseTrust.cs (PublicKeySpkiBase64)
import crypto from "node:crypto";

const { privateKey, publicKey } = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
console.log("# RELEASE_SIGNING_KEY (secret):");
console.log(privateKey.export({ type: "pkcs8", format: "pem" }).toString().trim());
console.log("\n# PublicKeySpkiBase64 (embed in the loader):");
console.log(publicKey.export({ type: "spki", format: "der" }).toString("base64"));
