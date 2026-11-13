using System.Diagnostics;
using System.Security.Cryptography;

namespace Mac1ota_Menu.Classes
{
    // Where the manifest and file bytes come from. The WinForms app binds it to the portal API; tests bind fakes.
    internal interface IReleaseSource
    {
        Task<(string Payload, string Signature)> GetManifestAsync(string product, CancellationToken ct);
        Task<Stream> OpenDownloadAsync(string product, CancellationToken ct);
    }

    internal enum SessionStage { Manifest, Download, Verify, Launch, Running, Cleanup }

    internal sealed record SessionResult(bool Success, string ErrorCode, string Message, string Version = "", int ExitCode = 0);

    // Generic product run: signed manifest -> download -> SHA-256 -> launch -> wait -> cleanup.
    // Product-specific facts (file name, admin requirement) come from the manifest, never from this class.
    internal static class ProductSession
    {
        public static async Task<SessionResult> RunAsync(
            IReleaseSource source, string product, string publicKeySpkiBase64, string baseDirectory,
            Action<SessionStage, long, long>? progress = null, CancellationToken ct = default)
        {
            ReleaseWorkspace.SweepOrphans(baseDirectory, product);
            using ReleaseWorkspace workspace = ReleaseWorkspace.Create(baseDirectory, product);
            try
            {
                progress?.Invoke(SessionStage.Manifest, 0, 0);
                (string payload, string signature) = await source.GetManifestAsync(product, ct);
                ReleaseManifest? manifest = ManifestVerifier.Verify(payload, signature, publicKeySpkiBase64, product, out string error);
                if (manifest == null) return new SessionResult(false, error, "Manifesto recusado: " + error + ". Nada foi executado.");

                ManifestFile file = manifest.Files[0];
                string target = Path.Combine(workspace.Directory, file.Name);
                string partial = target + ".part";

                progress?.Invoke(SessionStage.Download, 0, file.Size);
                using (SHA256 hash = SHA256.Create())
                {
                    await using Stream remote = await source.OpenDownloadAsync(product, ct);
                    await using FileStream output = new(partial, FileMode.CreateNew, FileAccess.Write, FileShare.None);
                    byte[] buffer = new byte[81920];
                    long total = 0;
                    int read;
                    while ((read = await remote.ReadAsync(buffer, ct)) > 0)
                    {
                        total += read;
                        if (total > file.Size) return new SessionResult(false, "size_mismatch", "Arquivo maior que o declarado. Download descartado.");
                        hash.TransformBlock(buffer, 0, read, null, 0);
                        output.Write(buffer, 0, read);
                        progress?.Invoke(SessionStage.Download, total, file.Size);
                    }
                    hash.TransformFinalBlock(Array.Empty<byte>(), 0, 0);
                    progress?.Invoke(SessionStage.Verify, total, file.Size);
                    if (total != file.Size) return new SessionResult(false, "size_mismatch", "Download incompleto. Descartado.");
                    if (!string.Equals(Convert.ToHexString(hash.Hash!), file.Sha256, StringComparison.OrdinalIgnoreCase))
                        return new SessionResult(false, "hash_mismatch", "Falha na verificação de integridade (SHA-256). Download descartado.");
                }
                File.Move(partial, target);

                progress?.Invoke(SessionStage.Launch, 0, 0);
                var info = new ProcessStartInfo { FileName = target, WorkingDirectory = workspace.Directory, UseShellExecute = true };
                if (manifest.Launch.RequiresAdmin) info.Verb = "runas";
                Process? process;
                try { process = Process.Start(info); }
                catch (System.ComponentModel.Win32Exception) { return new SessionResult(false, "launch_denied", "Permissão negada para iniciar o produto."); }
                if (process == null) return new SessionResult(false, "launch_failed", "Não foi possível iniciar o produto.");

                progress?.Invoke(SessionStage.Running, 0, 0);
                using (process)
                {
                    await process.WaitForExitAsync(ct);
                    int code = 0;
                    try { code = process.ExitCode; } catch (InvalidOperationException) { }
                    progress?.Invoke(SessionStage.Cleanup, 0, 0);
                    return new SessionResult(true, "", "Produto encerrado.", manifest.Version, code);
                }
            }
            catch (OperationCanceledException)
            {
                return new SessionResult(false, "cancelled", "Cancelado.");
            }
            catch (Exception ex) when (ex is IOException or HttpRequestException)
            {
                return new SessionResult(false, "io_error", "Falha na transferência: " + ex.Message);
            }
            // `using workspace` removes the folder (partial files included) on every path above.
        }
    }
}
