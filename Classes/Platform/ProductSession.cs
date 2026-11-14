using System.Diagnostics;
using System.Security.Cryptography;

namespace Mac1ota_Menu.Classes
{
    // Where the attestation and file bytes come from. The WinForms app binds it to the portal API; tests bind fakes.
    internal interface IReleaseSource
    {
        Task<(string Payload, string Signature)> GetManifestAsync(string product, CancellationToken ct);
        Task<Stream> OpenDownloadAsync(string product, CancellationToken ct);
    }

    internal enum SessionStage { Manifest, Download, Verify, Launch, Running, Cleanup }

    internal sealed record SessionResult(bool Success, string ErrorCode, string Message, string Version = "", int ExitCode = 0);

    // Generic product run: signed attestation -> download -> SHA-256 -> launch -> wait -> cleanup.
    // Product-specific facts (file name, admin requirement, minimum loader) come from the signed attestation, never from
    // this class or from the server's registry.
    internal static class ProductSession
    {
        // Launch rules from the signed attestation. A session hand-off (token via environment) needs a direct start of the
        // process; an elevated start goes through ShellExecute "runas", which cannot carry a private environment, so the
        // two are refused together instead of dropping the session silently.
        internal static ProcessStartInfo? BuildStartInfo(
            ReleaseManifest manifest, string target, string workingDirectory,
            IReadOnlyDictionary<string, string>? environment, out string error)
        {
            error = "";
            bool handOff = environment is { Count: > 0 };
            if (manifest.Launch.RequiresAdmin && handOff) { error = "session_handoff_unavailable_for_admin"; return null; }

            var info = new ProcessStartInfo { FileName = target, WorkingDirectory = workingDirectory };
            if (manifest.Launch.RequiresAdmin)
            {
                info.UseShellExecute = true;
                info.Verb = "runas";
            }
            else if (handOff)
            {
                info.UseShellExecute = false;
                foreach ((string key, string value) in environment!) info.Environment[key] = value;
            }
            else
            {
                info.UseShellExecute = true;
            }
            return info;
        }

        public static async Task<SessionResult> RunAsync(
            IReleaseSource source, string product, string publicKeySpkiBase64, string loaderVersion, string baseDirectory,
            Action<SessionStage, long, long>? progress = null, CancellationToken ct = default,
            Func<ReleaseManifest, IReadOnlyDictionary<string, string>?>? sessionEnvironment = null,
            bool detach = false)
        {
            ReleaseWorkspace.SweepOrphans(baseDirectory, product);
            using ReleaseWorkspace workspace = ReleaseWorkspace.Create(baseDirectory, product);
            try
            {
                progress?.Invoke(SessionStage.Manifest, 0, 0);
                (string payload, string signature) = await source.GetManifestAsync(product, ct);
                ReleaseManifest? manifest = ManifestVerifier.Verify(payload, signature, publicKeySpkiBase64, product, loaderVersion, out string error);
                if (manifest == null) return new SessionResult(false, error, "Release recusado: " + error + ". Nada foi executado.");

                string target = Path.Combine(workspace.Directory, manifest.FileName);
                string partial = target + ".part";

                progress?.Invoke(SessionStage.Download, 0, manifest.Size);
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
                        if (total > manifest.Size) return new SessionResult(false, "size_mismatch", "Arquivo maior que o declarado. Download descartado.");
                        hash.TransformBlock(buffer, 0, read, null, 0);
                        output.Write(buffer, 0, read);
                        progress?.Invoke(SessionStage.Download, total, manifest.Size);
                    }
                    hash.TransformFinalBlock(Array.Empty<byte>(), 0, 0);
                    progress?.Invoke(SessionStage.Verify, total, manifest.Size);
                    if (total != manifest.Size) return new SessionResult(false, "size_mismatch", "Download incompleto. Descartado.");
                    if (!string.Equals(Convert.ToHexString(hash.Hash!), manifest.Sha256, StringComparison.OrdinalIgnoreCase))
                        return new SessionResult(false, "hash_mismatch", "Falha na verificação de integridade (SHA-256). Download descartado.");
                }
                File.Move(partial, target);

                progress?.Invoke(SessionStage.Launch, 0, 0);
                ProcessStartInfo? info = BuildStartInfo(manifest, target, workspace.Directory, sessionEnvironment?.Invoke(manifest), out string startError);
                if (info == null) return new SessionResult(false, startError, "Não foi possível iniciar o produto: " + startError + ".");
                Process? process;
                try { process = Process.Start(info); }
                catch (System.ComponentModel.Win32Exception) { return new SessionResult(false, "launch_denied", "Permissão negada para iniciar o produto."); }
                if (process == null) return new SessionResult(false, "launch_failed", "Não foi possível iniciar o produto.");

                progress?.Invoke(SessionStage.Running, 0, 0);

                // Detached: the caller (the loader) is about to close, so it does not wait for the product. Its folder stays
                // while the executable is in use; the next run's SweepOrphans removes it once the product has exited.
                if (detach)
                {
                    process.Dispose();
                    return new SessionResult(true, "", "Produto iniciado.", manifest.Version);
                }

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
