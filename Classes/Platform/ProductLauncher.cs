namespace Mac1ota_Menu.Classes
{
    // Generic entry point for every external-exe product: the product code is the only product-specific input.
    // Files live in %LOCALAPPDATA%\LegitBaratinho\<product>\runs\<id> and are removed when the product exits.
    internal static class ProductLauncher
    {
        private static readonly string BaseDirectory =
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "LegitBaratinho");

        // Hand-off for products that run as the user (CS2 payload): token, device and product travel in environment
        // variables, never on the command line. Elevated products get none (see ProductSession.BuildStartInfo).
        private static IReadOnlyDictionary<string, string>? SessionEnvironment(ReleaseManifest manifest)
        {
            if (manifest.Launch.RequiresAdmin || string.IsNullOrWhiteSpace(ClientPortalApi.Token)) return null;
            return new Dictionary<string, string>
            {
                ["LB_SESSION_TOKEN"] = ClientPortalApi.Token!,
                ["LB_DEVICE_ID"] = DeviceIdentity.CurrentId,
                ["LB_PRODUCT"] = manifest.Product,
                ["LB_PORTAL_URL"] = ClientPortalApi.PortalBaseUrl
            };
        }

        public static async Task<(bool Success, string Message)> StartAsync(
            string product, string displayName, Action<SessionStage, long, long>? progress = null)
        {
            try
            {
                SessionResult result = await ProductSession.RunAsync(
                    new PortalReleaseSource(), product, ReleaseTrust.PublicKeySpkiBase64, LoaderUpdater.InstalledVersion, BaseDirectory, progress,
                    sessionEnvironment: SessionEnvironment);

                if (result.Success) return (true, displayName + " encerrado (v" + result.Version + ").");
                return (false, result.ErrorCode == "key_missing"
                    ? "Este loader não tem a chave de verificação de releases. Nada foi executado."
                    : result.ErrorCode == "loader_too_old"
                        ? "Esta versão do produto exige um loader mais novo. Atualize o loader e tente de novo."
                        : result.Message);
            }
            catch (ProductAccessException ex)
            {
                return (false, ex.Message);
            }
            catch (TaskCanceledException)
            {
                return (false, "O servidor demorou demais para responder.");
            }
        }
    }
}
