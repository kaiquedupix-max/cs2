using ImGuiNET;
using System.Numerics;
using Mac1ota_Menu.Data.Entity;
using Mac1ota_Menu.Data.Entity.Types;
using Mac1ota_Menu.Data.Game;
using Mac1ota_Menu.Data.Menu.Types;

namespace Mac1ota_Menu.Modules.Visual
{
    internal class Flags : IModule
    {
        public static Vector4 TeamTextColor = new(1, 1, 1, 1);
        public static Vector4 EnemyTextColor = new(1, 1, 1, 1);
        public static Colors TextColors = new(TeamTextColor, EnemyTextColor, null, null, false, false, false, false);
        public static bool ScopedEnabled = false;
        public static bool FlashEnabled = false;
        public static bool GunEnabled = false;
        private static Dictionary<string, int> enabledFlags = new();
        private static float _baseFontSize = 18f;
        private static float _flagPaddingX = 4f;
        private static float _flagLineHeight = 14f;

        public static void DrawFlags(Entity entity)
        {
            BoxRect? rect = entity.GetBoxRect();
            if (rect == null)
                return;

            if (GunEnabled)
                GunFlag(entity, rect);

            if (ScopedEnabled)
                ScopedFlag(entity, rect);
            else
                enabledFlags.Remove("Usando luneta");

            if (FlashEnabled)
                FlashedFlag(entity, rect);
            else
                enabledFlags.Remove("Flash");
        }

        private static Vector4 GetFlagColor(Entity entity)
        {
            if (entity.IsTeammate)
                return TextColors.TeamRGB ? Colors.Rgb(TextColors.TeamColor.W) : TextColors.TeamColor;
            else
                return TextColors.EnemyRGB ? Colors.Rgb(TextColors.EnemyColor.W) : TextColors.EnemyColor;
        }

        public static void ScopedFlag(Entity entity, BoxRect boxRect)
        {
            if (entity == null || GameState.renderer == null || GameState.LocalPlayer == null || entity.PawnAddress == GameState.LocalPlayer.PawnAddress || entity.Health <= 0 || entity.Position2D == new Vector2(-99, -99))
                return;

            Vector4 color = GetFlagColor(entity);

            if (!enabledFlags.ContainsKey("Usando luneta"))
                enabledFlags.TryAdd("Usando luneta", enabledFlags.Count + 1);

            enabledFlags.TryGetValue("Usando luneta", out int offsetY);

            string scopedText = entity.IsScoped ? "Usando luneta" : "Sem luneta";
            Vector2 textPos = new(boxRect.TopRight.X + _flagPaddingX, boxRect.TopRight.Y + (offsetY * _flagLineHeight));
            GameState.renderer.DrawList.AddText(Renderer.TextFontNormal, _baseFontSize, textPos, ImGui.ColorConvertFloat4ToU32(color), scopedText);
        }

        public static void FlashedFlag(Entity entity, BoxRect boxRect)
        {
            if (entity == null || GameState.LocalPlayer == null || GameState.renderer == null || entity.PawnAddress == GameState.LocalPlayer.PawnAddress || entity.Health <= 0 || entity.Position2D == new Vector2(-99, -99))
                return;

            Vector4 color = GetFlagColor(entity);

            if (!enabledFlags.ContainsKey("Flash"))
                enabledFlags.TryAdd("Flash", enabledFlags.Count + 1);

            enabledFlags.TryGetValue("Flash", out int offsetY);

            string flashText = entity.FlashDuration > 0.1 ? $"Cego por {MathF.Round(entity.FlashDuration, 2)}" : $"Sem cegueira";
            Vector2 textPos = new(boxRect.TopRight.X + _flagPaddingX, boxRect.TopRight.Y + (offsetY * _flagLineHeight));
            GameState.renderer.DrawList.AddText(Renderer.TextFontNormal, _baseFontSize, textPos, ImGui.ColorConvertFloat4ToU32(color), flashText);
        }

        public static void GunFlag(Entity? entity, BoxRect boxRect)
        {
            if (!GunEnabled || GameState.LocalPlayer == null || entity == null || entity.Health <= 0 || entity.PawnAddress == GameState.LocalPlayer.PawnAddress || entity.CurrentWeaponName == null || entity.Position2D == new Vector2(-99, -99) || GameState.renderer == null) return;

            string icon = GunHelper.GetIcon(entity.CurrentWeaponName);
            Vector4 color = GetFlagColor(entity);

            if (string.IsNullOrEmpty(icon))
                return;

            Vector2 textPos = new(boxRect.BottomMiddle.X, boxRect.BottomMiddle.Y + 10f);

            GameState.renderer.DrawList.AddText(Renderer.GunIconsFont, _baseFontSize, textPos, ImGui.ColorConvertFloat4ToU32(color), icon);
        }
    }
}
