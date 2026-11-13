namespace Mac1ota_Menu.Classes
{
    // Generic entry point for every external-exe product: the product code is the only product-specific input.
    // Files live in %LOCALAPPDATA%\LegitBaratinho\<product>\runs\<id> and are removed when the product exits.
    internal static class ProductLauncher
    {
        private static readonly string BaseDirectory =
            Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "LegitBaratinho");

        public static async Task<(bool Success, string Message)> StartAsync(
            string product, string displayName, Action<SessionStage, long, long>? progress = null)
        {
            try
            {
                SessionResult result = await ProductSession.RunAsync(
                    new PortalReleaseSource(), product, ReleaseTrust.PublicKeySpkiBase64, BaseDirectory, progress);

                if (result.Success) return (true, displayName + " encerrado (v" + result.Version + ").");
                return (false, result.ErrorCode == "key_missing"
                    ? "Este loader ainda não tem a chave de verificação de releases. Nada foi executado."
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
