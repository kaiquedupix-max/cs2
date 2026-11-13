namespace Mac1ota_Menu.Classes
{
    // Kept as a thin shim for the product screen; the download/verify/launch/cleanup logic is the generic
    // ProductLauncher (signed manifest, SHA-256, per-run workspace). Nothing here is Combat Arms specific but the code.
    internal static class CombatArmsLauncher
    {
        public const string ProductCode = "combatarms";

        public static Task<(bool Success, string Message)> StartAsync(Action<SessionStage, long, long>? progress = null) =>
            ProductLauncher.StartAsync(ProductCode, "Combat Arms Brasil 7", progress);
    }
}
