using ImGuiNET;
using System.Numerics;
using Mac1ota_Menu;
using Mac1ota_Menu.Classes;
using Mac1ota_Menu.Classes.DiscordRPC;
using Mac1ota_Menu.Data.Entity;
using Mac1ota_Menu.Data.Menu.Types;
using Mac1ota_Menu.ImGUI.Widgets;
using Mac1ota_Menu.Modules.Combat;
using Mac1ota_Menu.Modules.Legit;
using Mac1ota_Menu.Modules.Visual;
using static Mac1ota_Menu.ImGUI.Widgets.ColorPickers;
using static Mac1ota_Menu.ImGUI.Widgets.Combos;
using static Mac1ota_Menu.ImGUI.Widgets.Sliders;
using static Mac1ota_Menu.ImGUI.Widgets.Toggles;

internal class Sections
{
    public static float ChildRounding = 6f;
    public class SectionT(string label, int tab, Action content)
    {
        public string label = label;
        public Action content = content;
        public int tab = tab;
    }
    public static List<SectionT> sections = InitializeSections();

    public static List<SectionT> InitializeSections()
    {
        List<SectionT> sections = new()
        {
            new("Geral", 0, () =>
            {
                RenderBoolSettingWithWarning("Pulo automático", "Bhop.Enabled", () => Bhop.BhopEnable, v => Bhop.BhopEnable = v);
                RenderBoolSetting("Som de acerto", "HitStuff.Enabled", () => HitStuff.EnableHitSounds, v => HitStuff.EnableHitSounds = v);
                RenderFloatSlider("Volume dos acertos", "HitStuff.Volume", ref HitStuff.Volume, 0, 1);
                RenderIntCombo("Som selecionado", "HitStuff.CurrentHitSound", ref HitStuff.CurrentHitSound, HitStuff.HitSoundDisplays, HitStuff.HitSounds.Count, true);
                RenderBoolSettingWith1ColorPicker("Texto de tiro na cabeça", "HitStuff.HeadshotText", () => HitStuff.EnableHeadshotText, v => HitStuff.EnableHeadshotText = v, ref HitStuff.TextColor);
            }),
            new("Assistente de granadas", 0, () =>
            {
                RenderBoolSetting("Ativar assistente", "GernadeLineup.Enabled", () => GernadeLineup.Enabled, v => GernadeLineup.Enabled = v);
                RenderBoolSetting("Sempre exibir", "GernadeLineup.AlwaysShow", () => GernadeLineup.AlwaysShow, v => GernadeLineup.AlwaysShow = v);
                //Render2ColorPickers("Position Circle Color", ref GernadeLineup.PositionColorInside, ref GernadeLineup.PositionColorOutside);
                ImGui.InputText("Nome do lançamento", ref GernadeLineup.LineupName, 128);
                RenderIntCombo("Tipo de lançamento", "GernadeLineup.Type", ref GernadeLineup.SelectedType, GernadeLineup.TypesList, GernadeLineup.TypesList.Count, false);
                Mac1ota_Menu.ImGUI.Widgets.Button.RenderButton("Salvar lançamento", "GernadeLineup.Save", () => {
                    GernadeLineup.SaveLineup(GernadeLineup.LineupName, (GrenadeLaunchType)GernadeLineup.SelectedType);
                });
            }),

            new("Assistência de mira", 1, () =>
            {
                RenderBoolSetting("Ativar", "Aimbot.Enabled", () => Aimbot.AimbotEnable, v => Aimbot.AimbotEnable = v);
                RenderIntCombo("Ponto de mira", "Aimbot.AimBone", ref Aimbot.CurrentBone, [.. Aimbot.Bones], Aimbot.Bones.Length);
                Keybind.RenderKeybindChooser("Tecla da mira", "Aimbot.Keybind", ref Aimbot.AimbotKey, () => Aimbot.AimbotEnable);
                RenderBoolSetting("Mirar em aliados", "Aimbot.AimOnTeam", () => Aimbot.Team, v => Aimbot.Team = v);
                RenderFloatSlider("Suavização X", "Aimbot.SmoothingX", ref Aimbot.SmoothingX, 0, 20, "%.2f");
                RenderFloatSlider("Suavização Y", "Aimbot.SmoothingY", ref Aimbot.SmoothingY, 0, 20, "%.2f");
                RenderBoolSetting("Exibir campo de visão", "Aimbot.DrawFOV", () => Aimbot.DrawFov, v => Aimbot.DrawFov = v);
                RenderBoolSetting("Limitar campo de visão", "Aimbot.UseFOV", () => Aimbot.UseFOV, v => Aimbot.UseFOV = v);
                RenderBoolSetting("Exigir luneta", "Aimbot.ScopedOnly", () => Aimbot.ScopedOnly, v => Aimbot.ScopedOnly = v);
                RenderIntSlider("Tamanho do campo", "Aimbot.FOVSize", ref Aimbot.FovSize, 10, 1000, "%d");
                RenderColorPicker("Cor do campo", "Aimbot.FOVColor", ref Aimbot.FovColor, ref Aimbot.RGB);
                RenderBoolSetting("Verificar visibilidade", "Aimbot.VisibilityCheck", () => Aimbot.VisibilityCheck, v => Aimbot.VisibilityCheck = v);
                RenderBoolSetting("Linha até o alvo", "Aimbot.TargetLine", () => Aimbot.TargetLine, v => Aimbot.TargetLine = v);
            }),
            new("Controle de recuo", 1, () =>
            {
                RenderBoolSetting("Controle de recuo", "RCS.Enabled", () => RCS.Enabled, v => RCS.Enabled = v);
                RenderFloatSlider("Intensidade", "RCS.Strength", ref RCS.Strength, 0f, 1f, "%.2f");
            }),
            new("Disparo automático", 1, () =>
            {
                RenderBoolSetting("Disparo automático", "TriggerBot.Enabled", () => TriggerBot.Enabled, v => TriggerBot.Enabled = v);
                RenderBoolSetting("Ignorar aliados", "TriggerBot.TeamCheck", () => TriggerBot.TeamCheck, v => TriggerBot.TeamCheck = v);
                Keybind.RenderKeybindChooser("Tecla do disparo", "TriggerBot.Keybind", ref TriggerBot.TriggerKey, () => TriggerBot.Enabled);
                RenderIntSlider("Atraso máximo", "TriggerBot.MaxDelay", ref TriggerBot.MaxDelay, 0, 1000, "%d");
                RenderIntSlider("Atraso mínimo", "TriggerBot.MinDelay", ref TriggerBot.MinDelay, 0, 1000, "%d");
            }),

            new("Caixas dos jogadores", 2, () =>
            {
                RenderBoolSetting("Ativar", "BoxESP.Enabled", () => BoxESP.EnableESP, v => BoxESP.EnableESP = v);
                RenderIntCombo("Formato da caixa", "BoxESP.Shape", ref BoxESP.CurrentShape, BoxESP.Shapes.ToList(), BoxESP.Shapes.Length, false);
                RenderBoolSetting("Ignorar aliados", "BoxESP.TeamCheck", () => BoxESP.TeamCheck, v => BoxESP.TeamCheck = v);
                RenderBoolSettingWith2ColorPickers("Preenchimento em degradê", "BoxESP.BoxFillGradient", () => BoxESP.BoxFillGradient, v => BoxESP.BoxFillGradient = v, ref BoxESP.GradientColors.TeamRGB, ref BoxESP.GradientColors.EnemyRGB, ref BoxESP.GradientColors.TeamColor, ref BoxESP.GradientColors.EnemyColor); // TODO impl rgb
                RenderBoolSettingWith2ColorPickers("Preencher caixas", "BoxESP.FillBox", () => BoxESP.FillBox, v => BoxESP.FillBox = v, ref BoxESP.FillColors.TeamRGB, ref BoxESP.FillColors.EnemyRGB, ref BoxESP.FillColors.TeamColor, ref BoxESP.FillColors.EnemyColor);
                RenderBoolSettingWith1ColorPicker("Contorno interno", "BoxESP.InnerOutline", () => BoxESP.InnerOutline, v => BoxESP.InnerOutline = v, ref BoxESP.InnerOutlineColors.TeamRGB, ref BoxESP.InnerOutlineColors.TeamColor);
                RenderFloatSlider("Arredondamento", "BoxESP.Rounding", ref BoxESP.Rounding, 0, 5f);
                RenderFloatSlider("Brilho da caixa", "BoxESP.Glow", ref BoxESP.GlowAmount, 0f, 5f);
                RenderBoolSettingWith2ColorPickers("Contorno externo", "BoxESP.OuterOutline", () => BoxESP.OuterOutline, v => BoxESP.OuterOutline = v, ref BoxESP.OutlineColors.TeamRGB, ref BoxESP.OutlineColors.EnemyRGB, ref BoxESP.OutlineColors.TeamColor, ref BoxESP.OutlineColors.EnemyColor);
                RenderBoolSettingWith2ColorPickers("Verificar visibilidade", "BoxESP.VisibilityCheck", () => BoxESP.VisibilityCheck, v => BoxESP.VisibilityCheck = v, ref BoxESP.OccludedColors.TeamRGB, ref BoxESP.OccludedColors.EnemyRGB, ref BoxESP.OccludedColors.TeamColor, ref BoxESP.OccludedColors.EnemyColor);
                RenderBoolSetting("Verificar cegueira", "BoxESP.FlashCheck", () => BoxESP.FlashCheck, v => BoxESP.FlashCheck = v);
            }),
            new("Indicadores dos jogadores", 2, () =>
            {
                RenderBoolSetting("Barra de vida", "HealthBar.Enabled", () => HealthBar.EnableHealthBar, v => HealthBar.EnableHealthBar = v);
                RenderBoolSettingWith2ColorPickers("Barra de colete", "ArmorBar.Enabled", () => ArmorBar.EnableArmorBar, v => ArmorBar.EnableArmorBar = v, ref ArmorBar.ArmorColor.TeamRGB, ref ArmorBar.ArmorColor.EnemyRGB, ref ArmorBar.ArmorColor.TeamColor, ref ArmorBar.ArmorColor.EnemyColor);
                RenderBoolSetting("Direção do olhar", "EyeRay.Enabled", () => EyeRay.Enabled, v => EyeRay.Enabled = v);
            }),
            new("Informações", 2, () =>
            {
                Render2ColorPickers("Cor do texto", "Flags.TextColor", ref Flags.TextColors.TeamRGB, ref Flags.TextColors.EnemyRGB, ref Flags.TextColors.TeamColor, ref Flags.TextColors.EnemyColor);
                RenderBoolSetting("Ignorar aliados", "Flags.TeamCheck", () => Flags.TeamCheck, v => Flags.TeamCheck = v);
                RenderBoolSetting("Usando luneta", "Flags.Scoped", () => Flags.ScopedEnabled, v => Flags.ScopedEnabled = v);
                RenderBoolSetting("Cego por granada", "Flags.Flashed", () => Flags.FlashEnabled, v => Flags.FlashEnabled = v);
                RenderBoolSetting("Exibir distância", "DistanceText.Enabled", () => DistanceText.Enabled, v => DistanceText.Enabled = v);
                RenderBoolSetting("Exibir nome", "NameDisplay.Enabled", () => NameDisplay.Enabled, v => NameDisplay.Enabled = v);
                RenderBoolSetting("Ícone da arma", "Flags.GunIcon", () => Flags.GunEnabled, v => Flags.GunEnabled = v);
                RenderBoolSettingWith1ColorPicker("Exibir latência", "PingDisplay.Enabled", () => PingDisplay.Enabled, v => PingDisplay.Enabled = v, ref PingDisplay.PingTextColor);
            }),
            new("Esqueleto dos jogadores", 2, () =>
            {
                RenderBoolSettingWith2ColorPickers("Exibir esqueleto", "BoneESP.Enabled", () => BoneESP.EnableBoneESP, v => BoneESP.EnableBoneESP = v, ref BoneESP.VisibleColors.TeamRGB, ref BoneESP.VisibleColors.EnemyRGB, ref BoneESP.VisibleColors.TeamColor, ref BoneESP.VisibleColors.EnemyColor);
                RenderBoolSettingWith2ColorPickers("Verificar visibilidade", "BoneESP.VisibilityCheck", () => BoneESP.visibilityCheck, v => BoneESP.visibilityCheck = v, ref BoneESP.OccludedColors.TeamRGB, ref BoneESP.OccludedColors.EnemyRGB, ref BoneESP.OccludedColors.TeamColor, ref BoneESP.OccludedColors.EnemyColor);
                RenderIntCombo("Tipo de esqueleto", "BoneESP.Type", ref BoneESP.CurrentType, BoneESP.Types.ToList(), BoneESP.Types.Length);
                RenderBoolSetting("Ignorar aliados", "BoneESP.TeamCheck", () => BoneESP.TeamCheck, v => BoneESP.TeamCheck = v);
                RenderFloatSlider("Brilho do esqueleto", "BoneESP.Glow", ref BoneESP.GlowAmount, 0, 1f);
            }),
            new("Linhas dos jogadores", 2, () =>
            {
                RenderBoolSettingWith2ColorPickers("Ativado", "Tracers.Enabled", () => Tracers.EnableTracers, v => Tracers.EnableTracers = v, ref Tracers.TracerColors.TeamRGB, ref Tracers.TracerColors.EnemyRGB, ref Tracers.TracerColors.TeamColor, ref Tracers.TracerColors.EnemyColor);
                RenderIntCombo("Origem da linha", "Tracers.StartPosition", ref Tracers.CurrentStartPos, Tracers.StartPositions, Tracers.StartPositions.Count, false);
                RenderIntCombo("Destino da linha", "Tracers.EndPosition", ref Tracers.CurrentEndPos, Tracers.EndPositions.ToList(), Tracers.EndPositions.Length);
                RenderFloatSlider("Espessura da linha", "Tracers.Thickness", ref Tracers.LineThickness, 0.05f, 5f);
            }),
              new("Realce dos modelos", 2, () =>
            {
                RenderBoolSettingWith2ColorPickers("Realce dos modelos", "Chams.Enabled", () => Chams.Enabled, v => Chams.Enabled = v, ref Chams.VisibleColors.TeamRGB, ref Chams.VisibleColors.EnemyRGB,  ref Chams.VisibleColors.TeamColor, ref Chams.VisibleColors.EnemyColor);
                RenderBoolSetting("Ignorar aliados", "Chams.TeamCheck", () => Chams.TeamCheck, v => Chams.TeamCheck = v);
                RenderIntCombo("Estilo do realce", "Chams.Style", ref Chams.StyleIndex, Chams.StyleNames.ToList(), Chams.StyleNames.Length);
                //RenderBoolSetting("Pixel Perfect Depth", "Chams.PixelPerfect", () => Chams.PixelPerfect, v => Chams.PixelPerfect = v);
            }),
            new("Trajetória dos tiros", 2, () =>
            {
                RenderBoolSettingWith1ColorPicker("Ativado", "BulletTracers.Enabled", () => BulletTracers.Enabled, v => BulletTracers.Enabled = v, ref BulletTracers.TracerColors.PrimaryRGB, ref Tracers.TracerColors.PrimaryColor);
                RenderFloatSlider("Raio da trajetória", "BulletTracers.Radius", ref BulletTracers.Radius, 0.5f, 5f);
                RenderFloatSlider("Espessura da linha", "BulletTracers.Thickness", ref BulletTracers.Thickness, 0.5f, 10f);
                RenderFloatSlider("Duração da trajetória", "BulletTracers.Duration", ref BulletTracers.Duration, 0.5f, 15f);
            }),
            new("Indicadores de som", 2, () =>
            {
                RenderBoolSettingWith2ColorPickers("Ativado", "SoundESP.Enabled", () => SoundESP.Enabled, v => SoundESP.Enabled = v, ref SoundESP.VisibleColors.TeamRGB, ref SoundESP.VisibleColors.EnemyRGB, ref SoundESP.VisibleColors.TeamColor, ref SoundESP.VisibleColors.EnemyColor);
                RenderBoolSetting("Ignorar aliados", "SoundESP.TeamCheck", () => SoundESP.TeamCheck, v => SoundESP.TeamCheck = v);
                RenderFloatSlider("Raio", "SoundESP.Radius", ref SoundESP.MaxRadius, 1, 50);
                RenderFloatSlider("Duração", "SoundESP.Duration", ref SoundESP.MaxLifetime, 1, 25);
            }),

            new("Outros indicadores", 2, () =>
            {
                RenderBoolSetting("Cronômetro da bomba", "BombTimerOverlay.Enabled", () => BombTimerOverlay.EnableTimeOverlay, v => BombTimerOverlay.EnableTimeOverlay = v);
                RenderBoolSetting("Espectadores", "SpectatorList.Enabled", () => SpectatorList.Enabled, v => SpectatorList.Enabled = v);
                RenderBoolSettingWithWarning("Reduzir clarão", "NoFlash.Enabled", () => NoFlash.NoFlashEnable, v => NoFlash.NoFlashEnable = v);
                RenderBoolSettingWithWarning("Alterar campo de visão", "FovChanger.Enabled", () => FovChanger.Enabled, v => FovChanger.Enabled = v);
                RenderBoolSettingWithWarning("Terceira pessoa", "ThirdPerson.Enabled", () => ThirdPerson.Enabled, v => ThirdPerson.Enabled = v);
                RenderIntSlider("Campo de visão desejado", "FovChanger.FOV", ref FovChanger.FOV, 60, 160);
                RenderBoolSettingWith2ColorPickers("Radar", "Radar.Enabled", () => Radar.IsEnabled, v => Radar.IsEnabled = v, ref Radar.PointColors.TeamRGB, ref Radar.PointColors.EnemyRGB, ref  Radar.PointColors.TeamColor, ref Radar.PointColors.EnemyColor);
                RenderBoolSetting("Exibir aliados", "Radar.DrawTeam", () => Radar.DrawOnTeam, v => Radar.DrawOnTeam = v);
                RenderBoolSetting("Exibir cruz central", "Radar.DrawCross", () => Radar.DrawCrossb, v => Radar.DrawCrossb = v);
            }),
            new("Indicadores do cenário", 2, () =>
            {
                RenderBoolSettingWith2ColorPickers("Exibir C4", "C4ESP.Enabled", () => C4ESP.Enabled, v => C4ESP.Enabled = v, ref C4ESP.Colors.PrimaryRGB, ref C4ESP.Colors.SecondaryRGB, ref C4ESP.Colors.PrimaryColor, ref C4ESP.Colors.SecondaryColor);
                RenderBoolSettingWith1ColorPicker("Armas no chão", "WorldESP.DroppedWeapon", () => WorldESP.DroppedWeaponESP, v => WorldESP.DroppedWeaponESP = v, ref WorldESP.WeaponTextColor);
                RenderBoolSettingWith1ColorPicker("Exibir reféns", "WorldESP.Hostage", () => WorldESP.HostageESP, v => WorldESP.HostageESP = v, ref WorldESP.HostageTextColor);
                RenderBoolSettingWith1ColorPicker("Exibir galinhas", "WorldESP.Chicken", () => WorldESP.ChickenESP, v => WorldESP.ChickenESP = v, ref WorldESP.ChickenTextColor);
                RenderBoolSettingWith1ColorPicker("Exibir projéteis", "WorldESP.Projectile", () => WorldESP.ProjectileESP, v => WorldESP.ProjectileESP = v, ref WorldESP.ProjectileTextColor);
                RenderBoolSettingWith1ColorPicker("Caixas do cenário", "WorldESP.Boxes", () => WorldESP.DrawBoxes, v => WorldESP.DrawBoxes = v, ref WorldESP.BoxColor);
                RenderBoolSettingWith2ColorPickers("Limites do fogo", "WorldESP.MolotovBounds", () => WorldESP.MolotovBoundsESP, v => WorldESP.MolotovBoundsESP = v, ref WorldESP.MolotovColors.PrimaryRGB, ref WorldESP.MolotovColors.SecondaryRGB, ref WorldESP.MolotovColors.PrimaryColor, ref WorldESP.MolotovColors.SecondaryColor);
                RenderBoolSetting("Textos do cenário", "WorldESP.Text", () => WorldESP.DrawText, v => WorldESP.DrawText = v);
                RenderBoolSetting("Realce do cenário", "WorldESP.Chams", () => WorldESP.DrawChams, v => WorldESP.DrawChams = v);
            }),

            new("Interface", 4, () =>
            {
                RenderFloatSlider("Opacidade do menu", "Renderer.WindowAlpha", ref Renderer.WindowAlpha, 0.1f, 1.0f, "%.2f");
                Render2ColorPickers("Cores do menu", "Renderer.MenuColors", ref Renderer.MenuColors.PrimaryRGB, ref Renderer.MenuColors.SecondaryRGB, ref Renderer.MenuColors.PrimaryColor, ref Renderer.MenuColors.SecondaryColor, () =>{Renderer.ApplyColors(); });
                RenderFloatSlider("Velocidade das animações", "Renderer.AnimationSpeed", ref Renderer.AnimationSpeed, 0.01f, 1.0f, "%.2f");
                RenderFloatSlider("Velocidade das partículas", "Renderer.ParticleSpeed", ref Renderer.ParticleSpeed, 0, 10);
                RenderColorPicker("Cor das partículas", "Renderer.ParticleColor", ref Renderer.BackgroundEffectColors.PrimaryColor, ref Renderer.BackgroundEffectColors.PrimaryRGB, () =>{Renderer.ApplyColors(); });
                RenderColorPicker("Cor das conexões", "Renderer.LineColor", ref Renderer.BackgroundEffectColors.SecondaryColor, ref Renderer.BackgroundEffectColors.SecondaryRGB, () =>{Renderer.ApplyColors(); });
                Keybind.RenderKeybindChooser("Tecla do menu", "Renderer.OpenKeybind", ref Renderer.OpenKeyInt, () => Renderer.DrawWindow);
                RenderBoolSetting("Sons do menu", "Renderer.MenuSounds", () => Renderer.MenuSounds, v => Renderer.MenuSounds = v);
                RenderFloatSlider("Volume do menu", "Renderer.MenuSoundsVolume", ref Renderer.MenuSoundsVolume, 0, 1);
                RenderBoolSetting("Marca d'água", "Renderer.Watermark", () => Renderer.EnableWatermark, v => Renderer.EnableWatermark = v);
                RenderBoolSetting("Discord RPC", "Menu.Misc.DiscordRPC", () => Mac1ota_Menu.Classes.DiscordRPC.DiscordRPC.Enabled, v => Mac1ota_Menu.Classes.DiscordRPC.DiscordRPC.Enabled = v, () => Mac1ota_Menu.Classes.DiscordRPC.DiscordRPC.Update());
            }),
            new("Desempenho", 4, () =>
            {
                RenderBoolSetting("Visibilidade tradicional", "EntityManager.UseOldVisibilityCheck", () => EntityManager.UseOldVisibilityCheck, v => EntityManager.UseOldVisibilityCheck = v);
                RenderBoolSetting("VSync", "Renderer.VSync", () => Renderer.EnableVsync, v => Renderer.EnableVsync = v);
            }),
            new("Sobre", 4, () =>
            {
                ImGui.Text($"Mac1ota Menu V{Configs.Version}");
                ImGui.TextWrapped("Mac1ota Menu • Créditos originais: xfi0 / domok.");
                ImGui.TextWrapped("Mais informações: " + Configs.Link);
                ImGui.TextWrapped("Este projeto é gratuito.\nSe você pagou por ele, denuncie a venda aos autores originais.");
            }),
        };

        return sections;
    }

    public static void BeginSection(string label, Action content, Vector2 size)
    {
        ImGui.PushStyleVar(ImGuiStyleVar.ChildRounding, ChildRounding);
        ImGui.PushStyleColor(ImGuiCol.ChildBg, Renderer.MenuColors.SecondaryRGB ? Colors.Rgb(Renderer.WindowAlpha) : Renderer.MenuColors.SecondaryColor);
        ImGui.BeginChild(label, size, ImGuiChildFlags.Borders | ImGuiChildFlags.AutoResizeY);
        ImGui.TextColored(Renderer.TextCol, label);
        ImGui.Separator();
        content();
        ImGui.EndChild();
        ImGui.PopStyleColor();
        ImGui.PopStyleVar();
    }
}
