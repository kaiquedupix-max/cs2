using ImGuiNET;
using System.Numerics;
using Mac1ota_Menu.Data.Game;
using Mac1ota_Menu.Modules.Visual;

namespace Mac1ota_Menu.ImGUI.Widgets
{
    internal class Preview
    {
        private static Vector2 _windowSize = new(250, Renderer.MainWindowSize.Y);
        private static Vector2 _windowPos = Vector2.Zero;

        public static void DrawWindow()
        {
            var screenSize = GameState.renderer?.ScreenSize ?? Renderer.MainWindowSize;
            float menuX = (screenSize.X - Renderer.MainWindowSize.X) / 2f;
            _windowPos = new Vector2(Math.Clamp(menuX + Renderer.MainWindowSize.X + 16f, 0f, Math.Max(0f, screenSize.X - _windowSize.X)), Math.Max(0f, (screenSize.Y - Renderer.MainWindowSize.Y) / 2f));

            ImGui.SetNextWindowSize(_windowSize);
            ImGui.SetNextWindowPos(_windowPos, ImGuiCond.Always);
            ImGui.Begin("Prévia", ImGuiWindowFlags.NoTitleBar | ImGuiWindowFlags.NoMove | ImGuiWindowFlags.NoDocking | ImGuiWindowFlags.NoResize);
            ImGui.TextColored(Renderer.TextCol, "PRÉVIA DOS INDICADORES");
            var windowSize = ImGui.GetWindowSize();
            Vector2 windowCenter = new(windowSize.X / 2, windowSize.Y / 2);
            BoxESP.RenderESPPreview(windowCenter);
            ImGui.End();
        }
    }
}
