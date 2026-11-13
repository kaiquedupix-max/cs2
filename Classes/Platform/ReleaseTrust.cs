namespace Mac1ota_Menu.Classes
{
    // Trust anchor for release manifests: the PUBLIC half of the platform's release-signing key (ECDSA P-256, SPKI, base64).
    // Until it is filled in, the loader refuses to run any downloaded product (ManifestVerifier returns "key_missing").
    //
    // FILL: generate the key pair with `node website/tools/generate-signing-key.mjs`, store the printed private PEM only in
    // the server's RELEASE_SIGNING_KEY secret, and paste the printed base64 public key below. Rotating the key requires a
    // new loader build; keep the old private key available until every client has updated.
    internal static class ReleaseTrust
    {
        public const string PublicKeySpkiBase64 = "";
    }
}
