using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Mac1ota_Menu.Classes
{
    // Release attestation (schema 2) built and signed by the product's CI; mirrors website/releaseManifest.js and
    // website/tools/make-attestation.mjs. Signature: ECDSA P-256 / SHA-256, DER, base64, over the exact payload string.
    internal sealed class ManifestLaunch
    {
        public string Type { get; set; } = "";
        public bool RequiresAdmin { get; set; }
    }

    internal sealed class ManifestCompat
    {
        public string? MinLoader { get; set; }
        public string? GameBuild { get; set; }
    }

    internal sealed class ReleaseManifest
    {
        public int Schema { get; set; }
        public string Product { get; set; } = "";
        public string Version { get; set; } = "";
        public string FileName { get; set; } = "";
        public long Size { get; set; }
        public string Sha256 { get; set; } = "";
        public ManifestLaunch Launch { get; set; } = new();
        public ManifestCompat Compat { get; set; } = new();
    }

    internal static class ManifestVerifier
    {
        public const long MaxFileSize = 250L * 1024 * 1024;

        private static readonly JsonSerializerOptions Json = new() { PropertyNameCaseInsensitive = true };

        // Returns the attestation only when the signature is valid, it describes `expectedProduct`, the file facts are sane
        // and this loader is new enough. `error` is a stable code:
        // key_missing | bad_signature | bad_manifest | wrong_product | bad_file | loader_too_old.
        public static ReleaseManifest? Verify(
            string payload, string signatureBase64, string publicKeySpkiBase64, string expectedProduct, string loaderVersion,
            out string error)
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

            if (manifest == null || manifest.Schema != 2 || !IsVersion(manifest.Version) || manifest.Launch.Type is not ("external-exe" or "in-process"))
            { error = "bad_manifest"; return null; }
            if (!string.Equals(manifest.Product, expectedProduct, StringComparison.Ordinal))
            { error = "wrong_product"; return null; }

            bool nameOk = manifest.FileName.Length is > 0 and <= 120 && manifest.FileName == Path.GetFileName(manifest.FileName) && !manifest.FileName.StartsWith('.');
            bool hashOk = manifest.Sha256.Length == 64 && manifest.Sha256.All(Uri.IsHexDigit);
            if (!nameOk || !hashOk || manifest.Size <= 0 || manifest.Size > MaxFileSize) { error = "bad_file"; return null; }

            if (!string.IsNullOrEmpty(manifest.Compat.MinLoader))
            {
                if (!IsVersion(manifest.Compat.MinLoader)) { error = "bad_manifest"; return null; }
                if (CompareVersions(loaderVersion, manifest.Compat.MinLoader) < 0) { error = "loader_too_old"; return null; }
            }

            manifest.Sha256 = manifest.Sha256.ToLowerInvariant();
            return manifest;
        }

        public static bool IsVersion(string? v) =>
            !string.IsNullOrEmpty(v) && System.Text.RegularExpressions.Regex.IsMatch(v, @"^\d{1,4}\.\d{1,4}(\.\d{1,4})?$");

        // Numeric, part by part (1.10 > 1.9); missing parts count as 0.
        public static int CompareVersions(string a, string b)
        {
            int[] pa = a.Split('.').Select(int.Parse).ToArray(), pb = b.Split('.').Select(int.Parse).ToArray();
            for (int i = 0; i < System.Math.Max(pa.Length, pb.Length); i++)
            {
                int d = (i < pa.Length ? pa[i] : 0) - (i < pb.Length ? pb[i] : 0);
                if (d != 0) return d < 0 ? -1 : 1;
            }
            return 0;
        }
    }
}
