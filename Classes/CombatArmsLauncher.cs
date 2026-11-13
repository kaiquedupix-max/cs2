using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using System.Security.Cryptography;

namespace Mac1ota_Menu.Classes
{
    // Downloads (when the published version/SHA changed), verifies and starts the Combat Arms Brasil 7 external.
    // The server is asked with X-Product: combatarms and must echo the product back; a server that does not know the
    // product would answer with the CS2 release, which must never be run as the Combat Arms program.
    internal static class CombatArmsLauncher
    {
        public const string ProductCode = "combatarms";

        private static readonly string DataDir =
            Path.Combine(
                Environment.GetFolderPath(
                    Environment.SpecialFolder.LocalApplicationData),
                "LegitBaratinho",
                "CaBr");

        public static async Task<(bool Success, string Message)> StartAsync()
        {
            try
            {
                using HttpRequestMessage metaRequest =
                    ClientPortalApi.CreateProductRequest(
                        HttpMethod.Get,
                        "api/client/release",
                        ProductCode);

                using HttpResponseMessage meta =
                    await ClientPortalApi.SendAsync(
                        metaRequest,
                        HttpCompletionOption.ResponseContentRead);

                if (meta.StatusCode == HttpStatusCode.Forbidden)
                {
                    return (false, "Sua conta não possui acesso ativo ao Combat Arms Brasil 7.");
                }

                if (!meta.IsSuccessStatusCode)
                {
                    return (false, "Versão do Combat Arms Brasil 7 indisponível no servidor.");
                }

                ReleaseEnvelope? envelope =
                    await meta.Content.ReadFromJsonAsync<ReleaseEnvelope>();

                ReleaseInfo? release =
                    envelope?.Release;

                if (release == null ||
                    !string.Equals(
                        release.Product,
                        ProductCode,
                        StringComparison.Ordinal) ||
                    string.IsNullOrWhiteSpace(release.Version) ||
                    release.Sha256?.Length != 64)
                {
                    return (
                        false,
                        "O servidor ainda não publicou o Combat Arms Brasil 7. Nada foi executado.");
                }

                string exe =
                    Path.Combine(DataDir, "cbr.exe");

                string marker =
                    Path.Combine(DataDir, "payload.version");

                string want =
                    release.Version + "|" + release.Sha256.ToLowerInvariant();

                bool upToDate =
                    File.Exists(exe) &&
                    File.Exists(marker) &&
                    File.ReadAllText(marker).Trim() == want &&
                    Sha256Of(exe) == release.Sha256.ToLowerInvariant();

                if (!upToDate)
                {
                    (bool ok, string message) =
                        await DownloadAsync(
                            exe,
                            release.Sha256.ToLowerInvariant());

                    if (!ok)
                    {
                        return (false, message);
                    }

                    File.WriteAllText(marker, want);
                }

                try
                {
                    Process.Start(
                        new ProcessStartInfo
                        {
                            FileName = exe,
                            WorkingDirectory = DataDir,
                            UseShellExecute = true,
                            Verb = "runas"
                        });
                }
                catch (System.ComponentModel.Win32Exception)
                {
                    return (
                        false,
                        "Permissão de administrador negada: o external precisa dela para ler o jogo.");
                }

                return (true, "Combat Arms Brasil 7 iniciado (v" + release.Version + "). INSERT abre o menu no jogo.");
            }
            catch (TaskCanceledException)
            {
                return (false, "O servidor demorou demais para responder.");
            }
            catch (Exception ex)
            {
                return (false, "Falha ao iniciar o Combat Arms Brasil 7: " + ex.Message);
            }
        }

        private static async Task<(bool Success, string Message)> DownloadAsync(
            string destination,
            string expectedSha256)
        {
            Directory.CreateDirectory(DataDir);

            string partial =
                destination + ".part";

            try
            {
                using HttpRequestMessage request =
                    ClientPortalApi.CreateProductRequest(
                        HttpMethod.Get,
                        "api/client/download-loader",
                        ProductCode);

                using HttpResponseMessage response =
                    await ClientPortalApi.SendAsync(
                        request,
                        HttpCompletionOption.ResponseHeadersRead);

                if (!response.IsSuccessStatusCode)
                {
                    return (false, "Não foi possível baixar o Combat Arms Brasil 7.");
                }

                await using (Stream source =
                    await response.Content.ReadAsStreamAsync())
                await using (FileStream target =
                    new(partial, FileMode.Create, FileAccess.Write, FileShare.None))
                {
                    await source.CopyToAsync(target);
                }

                if (Sha256Of(partial) != expectedSha256)
                {
                    File.Delete(partial);
                    return (false, "Falha na verificação de integridade (SHA-256). Download descartado.");
                }

                File.Move(partial, destination, true);
                return (true, "Baixado.");
            }
            catch (Exception ex)
            {
                try
                {
                    if (File.Exists(partial))
                    {
                        File.Delete(partial);
                    }
                }
                catch
                {
                }

                return (false, "Falha ao baixar o Combat Arms Brasil 7: " + ex.Message);
            }
        }

        private static string Sha256Of(string path)
        {
            using FileStream stream =
                File.OpenRead(path);

            return Convert
                .ToHexString(
                    SHA256.HashData(stream))
                .ToLowerInvariant();
        }

        private sealed class ReleaseEnvelope
        {
            public ReleaseInfo? Release { get; set; }
        }

        private sealed class ReleaseInfo
        {
            public string? Product { get; set; }

            public string? Version { get; set; }

            public string? Sha256 { get; set; }
        }
    }
}
