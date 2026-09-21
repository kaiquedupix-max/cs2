using System.Diagnostics;
using System.Net;
using System.Net.Http.Json;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;

namespace Mac1ota_Menu.Classes
{
    internal static class LoaderUpdater
    {
        private static readonly HttpClient Http =
            new()
            {
                BaseAddress =
                    new Uri(
                        ClientPortalApi.PortalBaseUrl),

                Timeout =
                    TimeSpan.FromSeconds(
                        20)
            };

        private static readonly Lazy<string> CurrentBinaryHash =
            new(
                ComputeCurrentBinarySha256);

        public static LoaderReleaseInfo? Latest { get; private set; }

        public static bool LastCheckSucceeded { get; private set; }

        public static string InstalledVersion
        {
            get
            {
                if (Latest != null &&
                    IsCurrentBinary(
                        Latest.Sha256))
                {
                    return Latest.Version;
                }

                Version? assemblyVersion =
                    Assembly.GetExecutingAssembly()
                        .GetName()
                        .Version;

                if (assemblyVersion == null)
                {
                    return "1.0";
                }

                return assemblyVersion.Major +
                       "." +
                       assemblyVersion.Minor;
            }
        }

        public static string LatestVersion =>
            Latest?.Version ??
            "—";

        public static string CurrentVersion =>
            InstalledVersion;

        public static bool UpdateAvailable =>
            Latest != null &&
            !IsCurrentBinary(
                Latest.Sha256);

        public static async Task<LoaderReleaseInfo?> CheckLatestAsync()
        {
            try
            {
                using var request =
                    new HttpRequestMessage(
                        HttpMethod.Get,
                        "api/loader/latest?ts=" +
                        DateTimeOffset.UtcNow
                            .ToUnixTimeMilliseconds());

                request.Headers.CacheControl =
                    new System.Net.Http.Headers.CacheControlHeaderValue
                    {
                        NoCache =
                            true,

                        NoStore =
                            true
                    };

                using HttpResponseMessage response =
                    await Http.SendAsync(
                        request);

                if (response.StatusCode ==
                    HttpStatusCode.NoContent)
                {
                    Latest =
                        null;

                    LastCheckSucceeded =
                        true;

                    return null;
                }

                if (!response.IsSuccessStatusCode)
                {
                    Latest =
                        null;

                    LastCheckSucceeded =
                        false;

                    return null;
                }

                Latest =
                    await response.Content
                        .ReadFromJsonAsync<LoaderReleaseInfo>();

                LastCheckSucceeded =
                    Latest != null;

                return Latest;
            }
            catch
            {
                Latest =
                    null;

                LastCheckSucceeded =
                    false;

                return null;
            }
        }

        public static async Task<(bool Success, bool Restarting, string Message)>
            TryUpdateAtStartupAsync(
                Action<string>? status = null)
        {
            status?.Invoke(
                "Buscando atualização...");

            LoaderReleaseInfo? latest =
                await CheckLatestAsync();

            if (latest == null)
            {
                if (LastCheckSucceeded)
                {
                    status?.Invoke(
                        "Nenhuma atualização publicada no momento.");

                    return (
                        true,
                        false,
                        "Nenhuma atualização publicada no momento."
                    );
                }

                return (
                    false,
                    false,
                    "Não foi possível verificar a versão mais recente. Tente novamente."
                );
            }

            if (IsCurrentBinary(
                    latest.Sha256))
            {
                status?.Invoke(
                    "Você está na versão mais recente (v" +
                    latest.Version +
                    ").");

                return (
                    true,
                    false,
                    "Versão atual."
                );
            }

            status?.Invoke(
                "Atualização encontrada: v" +
                latest.Version +
                ". Baixando...");

            return await DownloadAndPrepareAsync(
                latest,
                DownloadByDeviceAsync,
                allowDeferred:
                    true,
                status);
        }

        public static async Task<(bool Success, bool Restarting, string Message)>
            EnsureLatestAfterLoginAsync(
                Action<string>? status = null)
        {
            status?.Invoke(
                "Confirmando versão...");

            LoaderReleaseInfo? latest =
                Latest ??
                await CheckLatestAsync();

            if (latest == null)
            {
                return (
                    LastCheckSucceeded,
                    false,
                    LastCheckSucceeded
                        ? "Nenhuma atualização publicada no momento."
                        : "Não foi possível consultar atualizações."
                );
            }

            if (IsCurrentBinary(
                    latest.Sha256))
            {
                return (
                    true,
                    false,
                    "Você já está na versão mais recente."
                );
            }

            status?.Invoke(
                "Atualização obrigatória v" +
                latest.Version +
                ". Baixando...");

            return await DownloadAndPrepareAsync(
                latest,
                ClientPortalApi.DownloadLatestLoaderAsync,
                allowDeferred:
                    false,
                status);
        }

        private static async Task<(bool Success, bool Restarting, string Message)>
            DownloadAndPrepareAsync(
                LoaderReleaseInfo latest,
                Func<string, Task<(bool Success, string Message)>> downloader,
                bool allowDeferred,
                Action<string>? status)
        {
            if (!latest.FileName.EndsWith(
                    ".exe",
                    StringComparison.OrdinalIgnoreCase))
            {
                return (
                    false,
                    false,
                    "A versão publicada não é um executável single-file. Publique novamente o .exe pelo painel."
                );
            }

            string tempRoot =
                Path.Combine(
                    Path.GetTempPath(),
                    "legitbaratinho-update-" +
                    Guid.NewGuid()
                        .ToString(
                            "N"));

            Directory.CreateDirectory(
                tempRoot);

            string downloadPath =
                Path.Combine(
                    tempRoot,
                    "legitbaratinho.xyz.new.exe");

            (bool downloadSuccess, string downloadMessage) =
                await downloader(
                    downloadPath);

            if (!downloadSuccess)
            {
                TryDelete(
                    tempRoot);

                if (allowDeferred &&
                    downloadMessage.Contains(
                        "Login necessário",
                        StringComparison.OrdinalIgnoreCase))
                {
                    status?.Invoke(
                        "Atualização v" +
                        latest.Version +
                        " encontrada. Faça login para autorizar.");

                    return (
                        true,
                        false,
                        "Atualização v" +
                        latest.Version +
                        " disponível — faça login para autorizar."
                    );
                }

                return (
                    false,
                    false,
                    downloadMessage
                );
            }

            status?.Invoke(
                "Verificando integridade da atualização...");

            if (!VerifySha256(
                    downloadPath,
                    latest.Sha256))
            {
                TryDelete(
                    tempRoot);

                return (
                    false,
                    false,
                    "A atualização baixada falhou na verificação de integridade."
                );
            }

            try
            {
                status?.Invoke(
                    "Aplicando v" +
                    latest.Version +
                    " e reiniciando...");

                string currentExe =
                    Environment.ProcessPath ??
                    throw new InvalidOperationException(
                        "Executável atual não encontrado.");

                string workingDirectory =
                    Path.GetDirectoryName(
                        currentExe) ??
                    AppContext.BaseDirectory;

                string scriptPath =
                    Path.Combine(
                        Path.GetTempPath(),
                        "legitbaratinho-updater-" +
                        Guid.NewGuid()
                            .ToString(
                                "N") +
                        ".ps1");

                string script =
                    BuildUpdateScript(
                        Environment.ProcessId,
                        currentExe,
                        workingDirectory,
                        downloadPath,
                        tempRoot,
                        scriptPath);

                File.WriteAllText(
                    scriptPath,
                    script,
                    new UTF8Encoding(
                        false));

                Process.Start(
                    new ProcessStartInfo
                    {
                        FileName =
                            "powershell.exe",

                        Arguments =
                            "-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File " +
                            QuoteArgument(
                                scriptPath),

                        UseShellExecute =
                            false,

                        CreateNoWindow =
                            true,

                        WorkingDirectory =
                            workingDirectory
                    });

                return (
                    true,
                    true,
                    "Atualizando para v" +
                    latest.Version +
                    ". Reiniciando..."
                );
            }
            catch (Exception ex)
            {
                TryDelete(
                    tempRoot);

                return (
                    false,
                    false,
                    "Não foi possível aplicar a atualização: " +
                    ex.Message
                );
            }
        }

        private static async Task<(bool Success, string Message)> DownloadByDeviceAsync(
            string destinationPath)
        {
            try
            {
                using var request =
                    new HttpRequestMessage(
                        HttpMethod.Get,
                        "api/loader/download");

                request.Headers.Add(
                    "X-Device-ID",
                    DeviceIdentity.CurrentId);

                using HttpResponseMessage response =
                    await Http.SendAsync(
                        request,
                        HttpCompletionOption.ResponseHeadersRead);

                if (!response.IsSuccessStatusCode)
                {
                    return (
                        false,
                        response.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden
                            ? "Login necessário para autorizar a atualização."
                            : "Não foi possível baixar a atualização."
                    );
                }

                await using Stream source =
                    await response.Content
                        .ReadAsStreamAsync();

                await using FileStream destination =
                    new(
                        destinationPath,
                        FileMode.Create,
                        FileAccess.Write,
                        FileShare.None);

                await source.CopyToAsync(
                    destination);

                return (
                    true,
                    "Atualização baixada."
                );
            }
            catch
            {
                return (
                    false,
                    "Não foi possível baixar a atualização."
                );
            }
        }

        private static bool IsCurrentBinary(
            string expectedSha256)
        {
            return string.Equals(
                CurrentBinaryHash.Value,
                expectedSha256?.Trim(),
                StringComparison.OrdinalIgnoreCase);
        }

        private static string ComputeCurrentBinarySha256()
        {
            try
            {
                string? currentExe =
                    Environment.ProcessPath;

                if (string.IsNullOrWhiteSpace(
                        currentExe) ||
                    !File.Exists(
                        currentExe))
                {
                    return string.Empty;
                }

                using FileStream stream =
                    File.OpenRead(
                        currentExe);

                return Convert
                    .ToHexString(
                        SHA256.HashData(
                            stream))
                    .ToLowerInvariant();
            }
            catch
            {
                return string.Empty;
            }
        }

        private static bool VerifySha256(
            string filePath,
            string expected)
        {
            try
            {
                using FileStream stream =
                    File.OpenRead(
                        filePath);

                string actual =
                    Convert
                        .ToHexString(
                            SHA256.HashData(
                                stream))
                        .ToLowerInvariant();

                return string.Equals(
                    actual,
                    expected?.Trim(),
                    StringComparison.OrdinalIgnoreCase);
            }
            catch
            {
                return false;
            }
        }

        private static string BuildUpdateScript(
            int processId,
            string currentExe,
            string workingDirectory,
            string downloadedExe,
            string tempRoot,
            string scriptPath)
        {
            string psExe =
                Ps(
                    currentExe);

            string psWorking =
                Ps(
                    workingDirectory);

            string psDownloaded =
                Ps(
                    downloadedExe);

            string psTemp =
                Ps(
                    tempRoot);

            string psScript =
                Ps(
                    scriptPath);

            var sb =
                new StringBuilder();

            sb.AppendLine(
                "$ErrorActionPreference = 'Stop'");

            sb.AppendLine(
                "try { Wait-Process -Id " +
                processId +
                " -ErrorAction SilentlyContinue } catch {}");

            sb.AppendLine(
                "Start-Sleep -Milliseconds 650");

            sb.AppendLine(
                "Copy-Item -LiteralPath '" +
                psDownloaded +
                "' -Destination '" +
                psExe +
                "' -Force");

            sb.AppendLine(
                "Start-Process -FilePath '" +
                psExe +
                "' -WorkingDirectory '" +
                psWorking +
                "'");

            sb.AppendLine(
                "Start-Sleep -Milliseconds 350");

            sb.AppendLine(
                "Remove-Item -LiteralPath '" +
                psTemp +
                "' -Recurse -Force -ErrorAction SilentlyContinue");

            sb.AppendLine(
                "Remove-Item -LiteralPath '" +
                psScript +
                "' -Force -ErrorAction SilentlyContinue");

            return sb.ToString();
        }

        private static string Ps(
            string value)
        {
            return value.Replace(
                "'",
                "''");
        }

        private static string QuoteArgument(
            string value)
        {
            return "\"" +
                   value.Replace(
                       "\"",
                       "\\\"") +
                   "\"";
        }

        private static void TryDelete(
            string path)
        {
            try
            {
                if (Directory.Exists(
                        path))
                {
                    Directory.Delete(
                        path,
                        true);
                }
            }
            catch
            {
            }
        }

        internal sealed class LoaderReleaseInfo
        {
            public string Version { get; set; } =
                "1.0";

            public string FileName { get; set; } =
                string.Empty;

            public long FileSize { get; set; }

            public string Sha256 { get; set; } =
                string.Empty;

            public string Notes { get; set; } =
                string.Empty;

            public DateTime UploadedAt { get; set; }
        }
    }
}
