using System.Numerics;
using Mac1ota_Menu.Data.Entity;
using Mac1ota_Menu.Data.Game;
using Mac1ota_Menu.Data.Game.MapParser;
using Mac1ota_Menu.Modules.Visual;

namespace Mac1ota_Menu.Classes
{
    public class VisibilityCheck : ThreadService
    {
        public static MapLoader? mapLoaderInstance = null;

        public static bool IsEntityVisible(Entity? e)
        {
            if (e == null || GameState.LocalPlayer?.Bones == null || e.Health <= 0 || e.Position2D == new Vector2(-99, -99) || e.Bones == null || mapLoaderInstance == null || e.IsDormant || GameState.renderer == null || GameState.memory == null)
                return false;

            if (!EntityManager.UseOldVisibilityCheck)
            {
                Vector3 origin = GameState.LocalPlayer.EyePosition;
                Vector3 target = e.Bones[(int)BoneESP.BoneIds.Head].Position; // head
                return mapLoaderInstance.IsVisible(origin, target);
            }

            return GameState.memory.ReadBool(e.PawnAddress, Offsets.m_entitySpottedState + Offsets.m_bSpotted);
        }

        public static bool Visible(Vector3 origin, Vector3 target)
        {
            if (mapLoaderInstance == null)
                return false;

            var visible = mapLoaderInstance.IsVisible(origin, target);
            return visible;
        }

        protected override void FrameAction()
        {
            string map = GlobalVar.GetCurrentMapName().Replace("maps/", "").Replace(".vpk", "");
            if (map == "Unknown")
                return;

            if (string.IsNullOrEmpty(map) || map == "<empty>") 
                return;

            if (mapLoaderInstance == null)
            {
                mapLoaderInstance ??= new MapLoader();

                if (!mapLoaderInstance.LoadMap(map))
                {
                    Console.WriteLine("Failed to load map: " + map);
                    return;
                }
            }
            if (mapLoaderInstance.PreviousMapName != map)
            {
                Events.GameEvents.BroadcastMapChanged(map);
                if (!mapLoaderInstance.LoadMap(map))
                {
                    Console.WriteLine("Failed to load map: " + map);
                    return;
                }
            }

            Thread.Sleep(3000);
        }
    }
}
