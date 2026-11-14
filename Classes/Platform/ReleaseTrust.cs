namespace Mac1ota_Menu.Classes
{
    // Trust anchor for release attestations: the PUBLIC half of the release-signing key (ECDSA P-256, SPKI, base64).
    // Public by design. The private half exists only as the protected secret RELEASE_SIGNING_KEY of each product's
    // GitHub repository; the CI of the product signs every release with it. A loader refuses any downloaded product whose
    // attestation does not verify against this key (ManifestVerifier returns "key_missing" if the value is empty).
    //
    // Rotation: generate a new pair (website/tools/generate-signing-key.mjs), set the new secret in every product
    // repository, replace this value and website/releaseTrust.js, ship both, and keep signing with the OLD key until the
    // new loader has reached all users.
    internal static class ReleaseTrust
    {
        public const string PublicKeySpkiBase64 =
            "MFkwEwYHKoZIzj0CAQYIKoZIzj0DAQcDQgAEMxtAx2nx+8aKThdeD2h9xlL76t/f7ZgxmHiZISt/rCCmm7HD+TN4nFXmMR8fZ4PseHIsinj0QnOxX5c47l6TYQ==";
    }
}
