using System.Diagnostics;
using Mac1ota_Menu.Classes.Memory;
using Mac1ota_Menu.Data.Entity;

namespace Mac1ota_Menu.Data.Game
{
    public static class GameState
    {
        public static Memory? memory; // public swed instance to use all arround
        public static Renderer? renderer;
        public static IntPtr client; // public client
        public static IntPtr EntityList { get; set; } // entity list pointer
        public static IntPtr CameraServices { get; set; } // camera services pointer
        public static uint CurrentFov { get; set; } = 60; // default FOV
        public static List<Entity.Entity?> Entities { get; set; } = [];
        public static Entity.Entity? LocalPlayer { get; set; } // local player entity
        public static int crosshairEnt { get; set; }
        public static uint Fflag { get; set; }
        public static uint Standing = 65665;
        public static uint Crouching = 655667; // crouching state
        public static IntPtr MoneyServices { get; set; }
        public static uint WeaponServices { get; set; }
        public static IntPtr ActionTrackingServices { get; set; }
        public static bool IsScoped { get; set; }
        public static IntPtr LocalController { get; set; }
        public static int RoundHeadshots { get; set; }
        public static int roundKills { get; set; }
        public static int RoundDamage { get; set; }
        public static List<WorldEntity?> worldEntities { get; set; } = [];

        public static bool CS2Open()
        {
            return GetCS2Process().Length > 0;
        }

        public static Process[] CS2Processes = [];

        public static Process[] GetCS2Process()
        {
            try
            {
                CS2Processes =
                    Process
                        .GetProcessesByName(
                            "cs2")
                        .Where(
                            process =>
                            {
                                try
                                {
                                    return !process.HasExited;
                                }
                                catch
                                {
                                    return false;
                                }
                            })
                        .ToArray();
            }
            catch
            {
                CS2Processes = [];
            }

            return CS2Processes;
        }

        public static bool IsConnectedToCS2()
        {
            if (memory == null ||
                client == IntPtr.Zero ||
                Renderer.CS2ProcessId == 0)
            {
                return false;
            }

            try
            {
                using Process process =
                    Process.GetProcessById(
                        Renderer.CS2ProcessId);

                return !process.HasExited;
            }
            catch
            {
                return false;
            }
        }

        public static void ResetConnection()
        {
            memory = null;
            client = IntPtr.Zero;
            EntityList = IntPtr.Zero;
            LocalPlayer = null;
            Entities = [];
            worldEntities = [];
            CS2Processes = [];

            Renderer.CS2ProcessId = 0;
        }
    }
}