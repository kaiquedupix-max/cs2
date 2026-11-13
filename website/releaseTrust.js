// Public half of the release-signing key (ECDSA P-256, SPKI PEM). Public by design: it only verifies signatures.
// The private half lives only in the protected secret RELEASE_SIGNING_KEY of each product repository (GitHub Actions)
// and is never present on this server. Rotation: generate a new pair (website/tools/generate-signing-key.mjs), replace
// this value and ReleaseTrust.cs, ship both, then keep the old pair until every deployed loader has updated.
// RELEASE_PUBLIC_KEY (env) overrides the constant, used by tests and staging.
export const RELEASE_PUBLIC_KEY_PEM = "";

export const releasePublicKey = () => (process.env.RELEASE_PUBLIC_KEY || RELEASE_PUBLIC_KEY_PEM || "").replace(/\\n/g, "\n").trim();
