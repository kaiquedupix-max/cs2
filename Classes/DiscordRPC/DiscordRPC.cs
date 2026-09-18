using DiscordRPC;
using Mac1ota_Menu.Data.Game;
using Mac1ota_Menu.Extensions;
using static System.Windows.Forms.VisualStyles.VisualStyleElement.ListView;

namespace Mac1ota_Menu.Classes.DiscordRPC
{
    internal class DiscordRPC
    {
        public static bool Enabled = false;
        private static DiscordRpcClient? Client;
        private static string _applicationId = "1540236665069633636";
        private static List<global::DiscordRPC.Button> _buttons = [];

        public static void Initialize()
        {
            Client = new(_applicationId);

            Client.OnReady += (sender, e) =>
            {
                Console.WriteLine("Connected to discord with user: " + e.User.Username);
            };

            Client.Initialize();
            _buttons.Add(new()
            {
                Label = "Créditos originais",
                Url = "https://github.com/xfi0"
            });

            Events.GameEvents.OnMapChanged += GameEvents_UpdateDetails;
        }

        public static void Update()
        {
            if (Client == null)
                return;

            if (!Enabled)
            {
                Client.ClearPresence();
                return;
            }

            var currentMap = GlobalVar.GetCurrentMapName().Replace("maps/", "").Replace("de_", "").FirstLetterToUpperCaseOrConvertNullToEmptyString().Replace(".vpk", "");
            string state = GetState() ?? "";

            Client.SetPresence(new()
            {
                Details = currentMap != "" ? "Usando Brasa Project.gg em - " + currentMap : "No lobby",
                Buttons = [.. _buttons],
                State = state,

                Assets = new()
                {
                    LargeImageKey = "menulogo",
                }
            });
        }

        private static string? GetState()
        {
            if (GameState.LocalPlayer == null)
                return null;

            if (GameState.LocalPlayer.Health <= 0)
                return "Morto";
            else
                return "Vivo";
        }

        private static void GameEvents_UpdateDetails(string obj)
        {
            Update();
        }
    }
}
