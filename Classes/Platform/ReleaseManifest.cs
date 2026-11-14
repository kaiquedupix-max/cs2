using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Mac1ota_Menu.Classes
{
    // Release manifest signed by the platform (ECDSA P-256 / SHA-256, DER). Mirrors website/releaseManifest.js.
    internal sealed class ManifestFile
    {
        public string Name { get; set; } = "";
        public long Size { get; set; }
        public string Sha256 { get; set; } = "";
    }

    internal sealed class ManifestLaunch
    {
        public string Type { get; set; } = "";
        public string? FileName { get; set; }
        public bool RequiresAdmin { get; set; }
    }

    internal sealed class ReleaseManifest
    {
        public int Schema { get; set; }
        public string Product { get; set; } = "";
        public string Channel { get; set; } = "";
        public string Version { get; set; } = "";
        public ManifestLaunch Launch { get; set; } = new();
        public string[] Dependencies { get; set; } = Array.Empty<string>();
        public ManifestFile[] Files { get; set; } = Array.Empty<ManifestFile>();
    }

    internal static class ManifestVerifier
    {
        public const long MaxFileSize = 250L * 1024 * 1024;

        private static readonly JsonSerializerOptions Json = new() { PropertyNameCaseInsensitive = true };

        // Returns the manifest only when the signature is valid AND it describes `expectedProduct`.
        // `error` is a stable code: key_missing | bad_signature | bad_manifest | wrong_product | bad_file.
        public static ReleaseManifest? Verify(
            string payload, string signatureBase64, string publicKeySpkiBase64, string expectedProduct, out string error)
        {
            error = "";
            if (string.IsNullOrWhiteSpace(publicKeySpkiBase64)) { error = "key_missing"; return null; }

            try
            {
                using ECDsa key = ECDsa.Create();
                key.ImportSubjectPublicKeyInfo(Convert.FromBase64String(publicKeySpkiBase64), out _);
                bool ok = key.VerifyData(
                    Encoding.UTF8.GetBytes(payload), Convert.FromBase64String(signatureBase64),
                    HashAlgorithmName.SHA256, DSASignatureFormat.Rfc3279DerSequence);
                if (!ok) { error = "bad_signature"; return null; }
            }
            catch (Exception ex) when (ex is FormatException or CryptographicException or ArgumentException)
            {
                error = "bad_signature";
                return null;
            }

            ReleaseManifest? manifest;
            try { manifest = JsonSerializer.Deserialize<ReleaseManifest>(payload, Json); }
            catch (JsonException) { error = "bad_manifest"; return null; }

            if (manifest == null || manifest.Schema != 1 || string.IsNullOrWhiteSpace(manifest.Version) || manifest.Files.Length != 1)
            { error = "bad_manifest"; return null; }
            if (!string.Equals(manifest.Product, expectedProduct, StringComparison.Ordinal))
            { error = "wrong_product"; return null; }

            ManifestFile file = manifest.Files[0];
            bool nameOk = file.Name.Length is > 0 and <= 120 && file.Name == Path.GetFileName(file.Name) && !file.Name.StartsWith('.');
            bool hashOk = file.Sha256.Length == 64 && file.Sha256.All(Uri.IsHexDigit);
            if (!nameOk || !hashOk || file.Size <= 0 || file.Size > MaxFileSize) { error = "bad_file"; return null; }

            file.Sha256 = file.Sha256.ToLowerInvariant();
            return manifest;
        }
    }
}
