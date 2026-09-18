using System.Diagnostics;
using System.IO.Compression;
using System.Net.Http.Json;
using System.Security.Cryptography;
using System.Text;
using System.Windows.Forms;

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
                        8)
            };

        private static readonly string VersionFile =
            Path.Combine(
                AppContext.BaseDirectory,
                "loader.version");

        public static LoaderReleaseInfo? Latest { get; private set; }

        public static string CurrentVersion
        {
            get
            {
                try
                {
                    if (File.Exists(
                            VersionFile))
                    {
                        string value =
                            File.ReadAllText(
                                    VersionFile)
                                .Trim();

                        if (!string.IsNullOrWhiteSpace(
                                value))
                        {
                            return value;
                        }
                    }
                }
                catch
                {
                }

                return "1.0";
            }
        }

        public static bool UpdateAvailable =>
            Latest != null &&
            IsNewer(
                Latest.Version,
                CurrentVersion);

        public static async Task<LoaderReleaseInfo?> CheckLatestAsync()
        {
            try
            {
                Latest =
                    await Http
                        .GetFromJsonAsync<LoaderReleaseInfo>(
                            "api/loader/latest");

                return Latest;
            }
            catch
            {
                Latest =
                    null;

                return null;
            }
        }

        public static async Task<(bool Success, bool Restarting, string Message)>
            EnsureLatestAfterLoginAsync()
        {
            LoaderReleaseInfo? latest =
                Latest ??
                await CheckLatestAsync();

            if (latest == null)
            {
                return (
                    true,
                    false,
                    "Não foi possível consultar atualizações."
                );
            }

            if (!IsNewer(
                    latest.Version,
                    CurrentVersion))
            {
                return (
                    true,
                    false,
                    "Você já está na versão mais recente."
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

            string extension =
                Path.GetExtension(
                    latest.FileName);

            string downloadPath =
                Path.Combine(
                    tempRoot,
                    "release" +
                    extension);

            (bool downloadSuccess, string downloadMessage) =
                await ClientPortalApi.DownloadLatestLoaderAsync(
                    downloadPath);

            if (!downloadSuccess)
            {
                TryDelete(
                    tempRoot);

                return (
                    false,
                    false,
                    downloadMessage
                );
            }

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
                string currentExe =
                    Environment.ProcessPath ??
                    throw new InvalidOperationException(
                        "Executável atual não encontrado.");

                string baseDirectory =
                    AppContext.BaseDirectory
                        .TrimEnd(
                            Path.DirectorySeparatorChar);

                string sourcePath =
                    downloadPath;

                bool isZip =
                    extension.Equals(
                        ".zip",
                        StringComparison.OrdinalIgnoreCase);

                if (isZip)
                {
                    string extractDirectory =
                        Path.Combine(
                            tempRoot,
                            "extracted");

                    ZipFile.ExtractToDirectory(
                        downloadPath,
                        extractDirectory,
                        true);

                    sourcePath =
                        ResolvePackageRoot(
                            extractDirectory);
                }

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
                        baseDirectory,
                        sourcePath,
                        tempRoot,
                        scriptPath,
                        latest.Version,
                        isZip);

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
                            baseDirectory
                    });

                return (
                    true,
                    true,
                    "Atualização baixada. Reiniciando..."
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

        private static string ResolvePackageRoot(
            string extractedDirectory)
        {
            string[] files =
                Directory.GetFiles(
                    extractedDirectory);

            string[] directories =
                Directory.GetDirectories(
                    extractedDirectory);

            if (files.Length == 0 &&
                directories.Length == 1)
            {
                return directories[0];
            }

            return extractedDirectory;
        }

        private static bool IsNewer(
            string remote,
            string local)
        {
            if (!TryParseVersion(
                    remote,
                    out Version? remoteVersion) ||
                !TryParseVersion(
                    local,
                    out Version? localVersion))
            {
                return !string.Equals(
                    remote,
                    local,
                    StringComparison.OrdinalIgnoreCase);
            }

            return remoteVersion >
                   localVersion;
        }

        private static bool TryParseVersion(
            string value,
            out Version? version)
        {
            string normalized =
                value.Trim()
                    .TrimStart(
                        'v',
                        'V');

            return Version.TryParse(
                normalized,
                out version);
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
            string baseDirectory,
            string sourcePath,
            string tempRoot,
            string scriptPath,
            string version,
            bool isZip)
        {
            string psExe =
                Ps(
                    currentExe);

            string psBase =
                Ps(
                    baseDirectory);

            string psSource =
                Ps(
                    sourcePath);

            string psTemp =
                Ps(
                    tempRoot);

            string psScript =
                Ps(
                    scriptPath);

            string psVersionFile =
                Ps(
                    VersionFile);

            string psVersion =
                Ps(
                    version);

            var sb =
                new StringBuilder();

            sb.AppendLine(
                "$ErrorActionPreference = 'Stop'");

            sb.AppendLine(
                "try { Wait-Process -Id " +
                processId +
                " -ErrorAction SilentlyContinue } catch {}");

            sb.AppendLine(
                "Start-Sleep -Milliseconds 500");

            if (isZip)
            {
                sb.AppendLine(
                    "Copy-Item -Path '" +
                    psSource +
                    "\\*' -Destination '" +
                    psBase +
                    "' -Recurse -Force");
            }
            else
            {
                sb.AppendLine(
                    "Copy-Item -LiteralPath '" +
                    psSource +
                    "' -Destination '" +
                    psExe +
                    "' -Force");
            }

            sb.AppendLine(
                "Set-Content -LiteralPath '" +
                psVersionFile +
                "' -Value '" +
                psVersion +
                "' -Encoding ASCII");

            sb.AppendLine(
                "Start-Process -FilePath '" +
                psExe +
                "' -WorkingDirectory '" +
                psBase +
                "'");

            sb.AppendLine(
                "Start-Sleep -Milliseconds 300");

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
