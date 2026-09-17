using System.Globalization;
using ImGuiNET;
using System.Numerics;
using Mac1ota_Menu.Data.Entity;
using Mac1ota_Menu.Data.Game;
using Mac1ota_Menu.Data.Game.C4;
using static Mac1ota_Menu.Renderer;

namespace Mac1ota_Menu.Modules.Visual
{
    public class BombTimerOverlay : IModule
    {
        public static bool EnableTimeOverlay = false;

        public static void TimeOverlay() // TODO: diplay more info
        {
            if (!EnableTimeOverlay || GameState.renderer == null)
                return;

            try
            {             
                Vector2 windowSize = new(240f, 100f);
                ImGui.SetNextWindowSize(windowSize,
                    ImGuiCond.Once); // ensure that the size doesn't reset to the default on resize
                ImGui.SetNextWindowPos(new Vector2((GameState.renderer.ScreenSize.X - windowSize.X - 300) / 2, 0), ImGuiCond.FirstUseEver);
                ImGui.Begin("#c4 info",
                    ImGuiWindowFlags.NoCollapse | ImGuiWindowFlags.NoDocking | ImGuiWindowFlags.NoTitleBar |
                    ImGuiWindowFlags.NoResize);

                C4? c4 = C4Info.C4;
                ImDrawListPtr windowDrawList = ImGui.GetWindowDrawList();
                if (c4 == null)
                {
                    windowDrawList.AddText(Renderer.TextFontNormal, 18f, ImGui.GetWindowPos() + new Vector2(20, 5), ImGui.ColorConvertFloat4ToU32(new Vector4(1f, 1f, 1f, 1f)), "C4 não foi plantada");
                    windowDrawList.AddText(Renderer.TextFontNormal, 18f, ImGui.GetWindowPos() + new Vector2(20, 25), ImGui.ColorConvertFloat4ToU32(new Vector4(1f, 1f, 1f, 1f)), $"Explode em: 40");
                    windowDrawList.AddText(Renderer.TextFontNormal, 18f, ImGui.GetWindowPos() + new Vector2(20, 45), ImGui.ColorConvertFloat4ToU32(new Vector4(1f, 1f, 1f, 1f)), $"Local: Nenhum");
                    windowDrawList.AddText(Renderer.TextFontNormal, 18f, ImGui.GetWindowPos() + new Vector2(20, 65), ImGui.ColorConvertFloat4ToU32(new Vector4(1f, 1f, 1f, 1f)), $"Desarmando: Não");
                }
                else
                {
                    windowDrawList.AddText(Renderer.TextFontNormal, 18f, ImGui.GetWindowPos() + new Vector2(20, 5), ImGui.ColorConvertFloat4ToU32(new Vector4(1f, 1f, 1f, 1f)), c4.Planted ? "C4 foi plantada" : "C4 não foi plantada");
                    windowDrawList.AddText(Renderer.TextFontNormal, 18f, ImGui.GetWindowPos() + new Vector2(20, 25), ImGui.ColorConvertFloat4ToU32(new Vector4(1f, 1f, 1f, 1f)), $"Explode em: {(c4.ExplosionTime > 0 ? MathF.Round(c4.ExplosionTime, 2).ToString() : "40")}");
                    windowDrawList.AddText(Renderer.TextFontNormal, 18f, ImGui.GetWindowPos() + new Vector2(20, 45), ImGui.ColorConvertFloat4ToU32(new Vector4(1f, 1f, 1f, 1f)), $"Local: {(c4.Planted ? c4.PlantedSite.ToString() : "Nenhum")}");
                    windowDrawList.AddText(Renderer.TextFontNormal, 18f, ImGui.GetWindowPos() + new Vector2(20, 65), ImGui.ColorConvertFloat4ToU32(new Vector4(1f, 1f, 1f, 1f)), $"Desarmando: {(c4.BeingDefused ? "Sim" : "Não")}");
                }

                ImGui.End();
            }
            catch (Exception ex)
            {
                Console.WriteLine("Exception in TimeOverlay: " + ex);
            }
        }
    }
}
