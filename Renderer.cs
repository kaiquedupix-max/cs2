using ClickableTransparentOverlay;
using ImGuiNET;
using SixLabors.ImageSharp;
using SixLabors.ImageSharp.PixelFormats;
using System.Numerics;
using System.Diagnostics;
using System.Reflection;
using Mac1ota_Menu.Classes;
using Mac1ota_Menu.Classes.Rendering;
using Mac1ota_Menu.Classes.Rendering.ChamsRenderer;
using Mac1ota_Menu.Data.Entity;
using Mac1ota_Menu.Data.Game;
using Mac1ota_Menu.Data.Menu.Types;
using Mac1ota_Menu.ImGUI.Widgets;
using Mac1ota_Menu.Modules.Combat;
using Mac1ota_Menu.Modules.Legit;
using Mac1ota_Menu.Modules.Visual;
using Vortice.Direct3D11;
using Image = SixLabors.ImageSharp.Image;

namespace Mac1ota_Menu
{
    public class Renderer : Overlay
    {
        public Renderer() : base("legitbaratinho.xyz", Screen.PrimaryScreen!.Bounds.Width, Screen.PrimaryScreen!.Bounds.Height)
        {
        }



        public static bool DrawWindow = false;
        public static bool EnableWatermark = true;
        public static bool ShowHotkeys = true;
        public static bool StreamMode = false;
        public static bool IgnoreAlliesInInformation = false;

        private bool? _lastStreamModeState;
        private IntPtr _lastStreamModeWindow = IntPtr.Zero;

        private IntPtr _taskbarHiddenForWindow = IntPtr.Zero;
        public static bool IsTextFontNormalLoaded => !TextFontNormal.Equals(default(ImFontPtr));
        public static bool IsTextFont24Loaded => !TextFont24.Equals(default(ImFontPtr));
        public static bool IsTextFont48Loaded => !TextFont48.Equals(default(ImFontPtr));
        public static bool IsTextFont60Loaded => !TextFont60.Equals(default(ImFontPtr));
        public static bool IsIconFontLoaded => !IconFont.Equals(default(ImFontPtr));
        public static bool IsGunIconFontLoaded => !GunIconsFont.Equals(default(ImFontPtr));
        public static bool MenuSounds = true;
        public static bool EnableVsync = true;
        public bool ShouldDraw = false;
        public List<Entity> Entities = [];
        public ImDrawListPtr DrawList;
        public ImDrawListPtr BgDrawList;
        public ImDrawListPtr FgDrawList;
        private int _selectedTab = 0;

        public static int NumberOfParticles = 50;
        public static int OverlayProcessId = 0;
        public static int CS2ProcessId = 0;

        public static float FpsUpdateInterval = 1.0f;
        public static float TimeSinceLastUpdate = 0.0f;
        public static float LastFPS = 0.0f;
        public static float WindowAlpha = 1f;
        public static float AnimationSpeed = 0.15f;
        public static float ParticleRadius = 2.5f;
        public static float ParticleSpeed = 0.53f;
        public static float MaxLineDistance = 300f;
        public static float MenuSoundsVolume = 0.8f;

        public Vector2 ScreenSize = new(Screen.PrimaryScreen!.Bounds.Width, Screen.PrimaryScreen.Bounds.Height);
        public static Vector2 TabSize;
        public static Vector2 BaseParticlePos = new();
        public static Vector2 MainWindowSize = new(1100, 720);
        public static Vector2 WatermarkSize = new(470, 40);

        private static Vector4 _secondaryColor = new(0.075f, 0.105f, 0.12f, 1);
        private static Vector4 _primaryColor = new(0.045f, 0.065f, 0.08f, 1);
        public static Vector4 TextCol = new(0.22f, 0.86f, 0.65f, 1.0f);
        public static Vector4 HeaderStartCol = TextCol;
        public static Vector4 HeaderEndCol = new(1, 1, 1, 0);
        private static Vector4 _particleColor = new(1f, 1f, 1f, 1f);
        private static Vector4 _lineColor = new(1, 1, 1, 0.33f);
        public static Colors MenuColors = new Colors(primaryColor: _primaryColor, secondaryColor: _secondaryColor);
        public static Colors BackgroundEffectColors = new Colors(primaryColor: _particleColor, secondaryColor: _lineColor);

        public static ImFontPtr TextFontNormal;
        public static ImFontPtr TextFont24;
        public static ImFontPtr TextFont48;
        public static ImFontPtr TextFont60;
        public static ImFontPtr IconFont;
        public static ImFontPtr GunIconsFont;

        public static int OpenKeyInt = 0x2D;

        public static Random Random = new();
        private static Chams _chamsRenderer = new();
        private static WorldESP.WorldChams _worldChamsRenderer = new();
        public static List<Vector2> Positions = [];
        public static List<Vector2> Velocities = [];
        public static HashSet<Keys> KeysSet =
        [
            Keys.ShiftKey, Keys.LShiftKey, Keys.RShiftKey,
    Keys.ControlKey, Keys.LControlKey, Keys.RControlKey,
    Keys.Menu, Keys.LMenu, Keys.RMenu
        ];
        private readonly object _entityLock = new();

        public static ID3D11Device? GetDevice()
        {
            Renderer? overlay = GameState.renderer;
            if (overlay == null)
                return null;

            Type? baseType = typeof(Overlay);
            if (baseType == null)
                return null;

            return (ID3D11Device?)baseType.GetField("device", BindingFlags.NonPublic | BindingFlags.Instance)?.GetValue(overlay);
        }

        public static ID3D11DeviceContext? GetDeviceContext()
        {
            Renderer? overlay = GameState.renderer;
            if (overlay == null)
                return null;

            Type? baseType = typeof(Overlay);
            if (baseType == null)
                return null;

            return (ID3D11DeviceContext?)baseType.GetField("deviceContext", BindingFlags.NonPublic | BindingFlags.Instance)?.GetValue(overlay);
        }

        public static System.Collections.IDictionary? GetTextureResources()
        {
            Renderer? overlay = GameState.renderer;
            if (overlay == null)
                return null;

            Type? baseType = typeof(Overlay);
            if (baseType == null)
                return null;

            Object? renderer = baseType.GetField("renderer", BindingFlags.NonPublic | BindingFlags.Instance)?.GetValue(overlay);
            if (renderer == null)
                return null;

            return (System.Collections.IDictionary?)renderer.GetType().GetField("textureResources", BindingFlags.NonPublic | BindingFlags.Instance)?.GetValue(renderer);
        }

        public void UpdateEntities(IEnumerable<Entity> newEntities)
        {
            lock (_entityLock)
                Entities = (List<Entity>)newEntities ?? newEntities.ToList();
        }

        public static void LoadFonts()
        {
            try
            {
                if (ImGui.GetCurrentContext() == IntPtr.Zero) ImGui.CreateContext();

                var io = ImGui.GetIO();

                ushort[] ranges = { 0x0020, 0x00FF, 0xE000, 0xF8FF, 0 };
                unsafe
                {
                    byte[] iconFontData = LoadFont("NotoSans-BoldIcons.ttf");

                    fixed (ushort* pRanges = ranges)
                    {
                        byte[] d1 = (byte[])iconFontData.Clone();
                        byte[] d2 = (byte[])iconFontData.Clone();
                        byte[] d3 = (byte[])iconFontData.Clone();
                        byte[] d4 = (byte[])iconFontData.Clone();
                        byte[] d5 = (byte[])iconFontData.Clone();

                        fixed (byte* p2 = d2) TextFontNormal = io.Fonts.AddFontFromMemoryTTF((IntPtr)p2, d2.Length, 18.0f, null, (IntPtr)pRanges);
                        fixed (byte* p1 = d1) IconFont = io.Fonts.AddFontFromMemoryTTF((IntPtr)p1, d1.Length, 24.0f, null, (IntPtr)pRanges);
                        fixed (byte* p3 = d3) TextFont24 = io.Fonts.AddFontFromMemoryTTF((IntPtr)p3, d3.Length, 24.0f, null, (IntPtr)pRanges);
                        fixed (byte* p4 = d4) TextFont48 = io.Fonts.AddFontFromMemoryTTF((IntPtr)p4, d4.Length, 48.0f, null, (IntPtr)pRanges);
                        fixed (byte* p5 = d5) TextFont60 = io.Fonts.AddFontFromMemoryTTF((IntPtr)p5, d5.Length, 60.0f, null, (IntPtr)pRanges);
                    }
                }

                unsafe
                {
                    byte[] gunIconsData = LoadFont("undefeated.ttf");

                    fixed (byte* gunFontData = gunIconsData)
                        GunIconsFont = io.Fonts.AddFontFromMemoryTTF((IntPtr)gunFontData, gunIconsData.Length, 24.0f);
                }

                io.Fonts.Build();
            }
            catch (Exception e)
            {
                Console.WriteLine(e);
            }
        }

        private static byte[] LoadFont(string fileName)
        {
            Assembly asm = Assembly.GetExecutingAssembly();

            Stream? stream = asm.GetManifestResourceStream("Mac1ota_Menu.Resources.fonts." + fileName) ?? throw new Exception("Font was not found");
            byte[] fontData = new byte[stream.Length];
            stream.ReadExactly(fontData);

            return fontData;
        }

        protected override Task PostInitialized()
        {
            var io = ImGui.GetIO();
            io.ConfigFlags |= ImGuiConfigFlags.NavEnableKeyboard;
            io.ConfigFlags |= ImGuiConfigFlags.NavEnableGamepad;
            io.ConfigFlags |= ImGuiConfigFlags.ViewportsEnable;
            io.ConfigViewportsNoAutoMerge = true;
            io.ConfigViewportsNoTaskBarIcon = true;
            // this makes cpu useage about 2x but makes the overlay like 2ms lat
            //int disabled = 1;
            //DwmSetWindowAttribute(Process.GetCurrentProcess().Handle, 3, ref disabled, sizeof(int));
            //timeBeginPeriod(1);
            //Process.GetCurrentProcess().PriorityClass = ProcessPriorityClass.High;
            var style = ImGui.GetStyle();
            ApplyStyles(style);

            return Task.CompletedTask;
        }

        protected override void Render()
        {
            try
            {
                this.VSync = EnableVsync;

                HideTaskbarButton();
                ApplyStreamMode();

                RenderESPOverlay();
                RenderMainWindow();
                RenderWaterMark();
                if (ShowHotkeys)
                    Keybind.RenderKeybindMenu();
                SpectatorList.DrawMenu();
                BombTimerOverlay.TimeOverlay();
                //Library.UpdateNotifications(io.DeltaTime);
                Toggles.LoopAllActions();
            }
            catch (Exception ex)
            {
                Console.WriteLine(ex);
            }
        }


        private void HideTaskbarButton()
        {
            using Process currentProcess =
                Process.GetCurrentProcess();

            currentProcess.Refresh();

            IntPtr windowHandle =
                currentProcess.MainWindowHandle;

            if (windowHandle ==
                IntPtr.Zero)
            {
                windowHandle =
                    User32.FindWindow(
                        null!,
                        "legitbaratinho.xyz");
            }

            if (windowHandle ==
                    IntPtr.Zero ||
                windowHandle ==
                    _taskbarHiddenForWindow)
            {
                return;
            }

            if (TaskbarWindowHelper.TryRemoveTaskbarButton(
                    windowHandle))
            {
                _taskbarHiddenForWindow =
                    windowHandle;
            }
        }

        private void ApplyStreamMode()
        {
            using Process currentProcess =
                Process.GetCurrentProcess();

            currentProcess.Refresh();

            IntPtr windowHandle =
                currentProcess.MainWindowHandle;

            if (windowHandle ==
                IntPtr.Zero)
            {
                return;
            }

            if (_lastStreamModeState ==
                    StreamMode &&
                _lastStreamModeWindow ==
                    windowHandle)
            {
                return;
            }

            uint affinity =
                StreamMode
                    ? User32.WDA_EXCLUDEFROMCAPTURE
                    : User32.WDA_NONE;

            bool applied =
                User32.SetWindowDisplayAffinity(
                    windowHandle,
                    affinity);

            if (!applied &&
                StreamMode)
            {
                // Compatibilidade com versões antigas do Windows.
                User32.SetWindowDisplayAffinity(
                    windowHandle,
                    User32.WDA_MONITOR);
            }

            _lastStreamModeState =
                StreamMode;

            _lastStreamModeWindow =
                windowHandle;
        }

        public void RenderWaterMark()
        {
            if (!EnableWatermark)
                return;

            ImGui.PushFont(TextFontNormal);
            ImGui.SetNextWindowSize(WatermarkSize);
            ImGui.SetNextWindowPos(new(ScreenSize.X - WatermarkSize.X, 0));
            ImGui.Begin("wm", ImGuiWindowFlags.NoResize | ImGuiWindowFlags.NoDocking | ImGuiWindowFlags.NoTitleBar);
            var drawList = ImGui.GetWindowDrawList();
            Vector2 textPosition = ImGui.GetWindowPos() + new Vector2(10, 10);
            TimeSinceLastUpdate += ImGui.GetIO().DeltaTime;

            if (TimeSinceLastUpdate >= FpsUpdateInterval)
            {
                LastFPS = 1f / ImGui.GetIO().DeltaTime;
                TimeSinceLastUpdate = 0.0f;
            }

            drawList.AddText(new(textPosition.X, textPosition.Y), ImGui.ColorConvertFloat4ToU32(new(1, 1, 1, 1)), $"legitbaratinho.xyz | FPS: {Math.Round(LastFPS)} | V-{LoaderUpdater.InstalledVersion} | {DateTime.Now.ToLocalTime().ToShortTimeString()}");
            ImGui.PopFont();
            ImGui.End();

        }
        private void RenderESPOverlay()
        {
            ImGui.SetNextWindowSize(ScreenSize);
            ImGui.SetNextWindowPos(Vector2.Zero);
            ImGui.Begin("Mac1otaMenuOverlay",
                ImGuiWindowFlags.NoTitleBar |
                ImGuiWindowFlags.NoResize |
                ImGuiWindowFlags.NoScrollbar |
                ImGuiWindowFlags.NoScrollWithMouse |
                ImGuiWindowFlags.NoCollapse |
                ImGuiWindowFlags.NoBackground |
                ImGuiWindowFlags.NoSavedSettings |
                ImGuiWindowFlags.NoInputs |
                ImGuiWindowFlags.NoMove
            );
            DrawList = ImGui.GetWindowDrawList();
            var io = ImGui.GetIO();
            io.Framerate = 0;
            io.ConfigViewportsNoAutoMerge = true;
            io.ConfigViewportsNoTaskBarIcon = true;

            //ImGui.ShowMetricsWindow();
            ImGui.End();
        }

        public static void ApplyColors()
        {
            var style = ImGui.GetStyle();

            var windowPrimaryColor = MenuColors.PrimaryRGB ? Colors.Rgb(WindowAlpha) : MenuColors.PrimaryColor;
            var windowSecondaryColor = MenuColors.SecondaryRGB ? Colors.Rgb(WindowAlpha) : MenuColors.SecondaryColor;

            style.Colors[(int)ImGuiCol.Text] = new(0.84f, 0.84f, 0.84f, WindowAlpha);
            style.Colors[(int)ImGuiCol.TextDisabled] = new(0.45f, 0.45f, 0.45f, WindowAlpha);
            style.Colors[(int)ImGuiCol.WindowBg] = new(windowPrimaryColor.X, windowPrimaryColor.Y, windowPrimaryColor.Z, WindowAlpha);
            style.Colors[(int)ImGuiCol.ChildBg] = new(windowSecondaryColor.X, windowSecondaryColor.Y, windowSecondaryColor.Z, WindowAlpha);
            style.Colors[(int)ImGuiCol.PopupBg] = new(windowSecondaryColor.X, windowSecondaryColor.Y, windowSecondaryColor.Z, WindowAlpha);
            style.Colors[(int)ImGuiCol.Border] = new(0.22f, 0.22f, 0.22f, WindowAlpha);
            style.Colors[(int)ImGuiCol.BorderShadow] = new(0.0f, 0.0f, 0.0f, 0.0f);
            style.Colors[(int)ImGuiCol.FrameBg] = new(0.152f, 0.152f, 0.152f, WindowAlpha);
            style.Colors[(int)ImGuiCol.FrameBgHovered] = new(0.180f, 0.188f, 0.196f, WindowAlpha);
            style.Colors[(int)ImGuiCol.FrameBgActive] = new(0.200f, 0.208f, 0.216f, WindowAlpha);
            style.Colors[(int)ImGuiCol.TitleBg] = new(0.085f, 0.085f, 0.085f, WindowAlpha);
            style.Colors[(int)ImGuiCol.TitleBgActive] = new(windowSecondaryColor.X, windowSecondaryColor.Y, windowSecondaryColor.Z, WindowAlpha);
            style.Colors[(int)ImGuiCol.TitleBgCollapsed] = new(0.085f, 0.085f, 0.085f, WindowAlpha);
            style.Colors[(int)ImGuiCol.MenuBarBg] = new(windowSecondaryColor.X, windowSecondaryColor.Y, windowSecondaryColor.Z, WindowAlpha);
            style.Colors[(int)ImGuiCol.ScrollbarBg] = new(0.102f, 0.102f, 0.102f, WindowAlpha);
            style.Colors[(int)ImGuiCol.ScrollbarGrab] = new(0.22f, 0.22f, 0.22f, WindowAlpha);
            style.Colors[(int)ImGuiCol.ScrollbarGrabHovered] = new(0.28f, 0.28f, 0.28f, WindowAlpha);
            style.Colors[(int)ImGuiCol.ScrollbarGrabActive] = new(0.32f, 0.32f, 0.32f, WindowAlpha);
            style.Colors[(int)ImGuiCol.CheckMark] = new(0.84f, 0.84f, 0.84f, WindowAlpha);
            style.Colors[(int)ImGuiCol.SliderGrab] = new(0.28f, 0.28f, 0.28f, WindowAlpha);
            style.Colors[(int)ImGuiCol.SliderGrabActive] = new(0.36f, 0.36f, 0.36f, WindowAlpha);
            style.Colors[(int)ImGuiCol.Button] = new(windowSecondaryColor.X, windowSecondaryColor.Y, windowSecondaryColor.Z, WindowAlpha);
            style.Colors[(int)ImGuiCol.ButtonHovered] = new(0.180f, 0.188f, 0.196f, WindowAlpha);
            style.Colors[(int)ImGuiCol.ButtonActive] = new(0.152f, 0.152f, 0.152f, WindowAlpha);
            style.Colors[(int)ImGuiCol.Header] = new(0.152f, 0.152f, 0.152f, WindowAlpha);
            style.Colors[(int)ImGuiCol.HeaderHovered] = new(0.180f, 0.188f, 0.196f, WindowAlpha);
            style.Colors[(int)ImGuiCol.HeaderActive] = new(0.200f, 0.208f, 0.216f, WindowAlpha);
            style.Colors[(int)ImGuiCol.Separator] = new(0.22f, 0.22f, 0.22f, WindowAlpha);
            style.Colors[(int)ImGuiCol.SeparatorHovered] = new(0.32f, 0.32f, 0.32f, WindowAlpha);
            style.Colors[(int)ImGuiCol.SeparatorActive] = new(0.40f, 0.40f, 0.40f, WindowAlpha);
            style.Colors[(int)ImGuiCol.ResizeGrip] = new(0.22f, 0.22f, 0.22f, WindowAlpha);
            style.Colors[(int)ImGuiCol.ResizeGripHovered] = new(0.32f, 0.32f, 0.32f, WindowAlpha);
            style.Colors[(int)ImGuiCol.ResizeGripActive] = new(0.40f, 0.40f, 0.40f, WindowAlpha);
            style.Colors[(int)ImGuiCol.Tab] = new(windowSecondaryColor.X, windowSecondaryColor.Y, windowSecondaryColor.Z, WindowAlpha);
            style.Colors[(int)ImGuiCol.TabHovered] = new(0.180f, 0.188f, 0.196f, WindowAlpha);
            style.Colors[(int)ImGuiCol.TabSelected] = new(0.152f, 0.152f, 0.152f, WindowAlpha);
            style.Colors[(int)ImGuiCol.TabDimmed] = new(0.102f, 0.102f, 0.102f, WindowAlpha);
            style.Colors[(int)ImGuiCol.TabDimmedSelected] = new(windowSecondaryColor.X, windowSecondaryColor.Y, windowSecondaryColor.Z, WindowAlpha);
            style.Colors[(int)ImGuiCol.PlotLines] = new(0.60f, 0.60f, 0.60f, WindowAlpha);
            style.Colors[(int)ImGuiCol.PlotLinesHovered] = new(0.84f, 0.84f, 0.84f, WindowAlpha);
            style.Colors[(int)ImGuiCol.PlotHistogram] = new(0.50f, 0.50f, 0.50f, WindowAlpha);
            style.Colors[(int)ImGuiCol.PlotHistogramHovered] = new(0.70f, 0.70f, 0.70f, WindowAlpha);
            style.Colors[(int)ImGuiCol.TableHeaderBg] = new(windowSecondaryColor.X, windowSecondaryColor.Y, windowSecondaryColor.Z, WindowAlpha);
            style.Colors[(int)ImGuiCol.TableBorderStrong] = new(0.22f, 0.22f, 0.22f, WindowAlpha);
            style.Colors[(int)ImGuiCol.TableBorderLight] = new(0.16f, 0.16f, 0.16f, WindowAlpha);
            style.Colors[(int)ImGuiCol.TableRowBg] = new(0.0f, 0.0f, 0.0f, 0.0f);
            style.Colors[(int)ImGuiCol.TableRowBgAlt] = new(windowSecondaryColor.X, windowSecondaryColor.Y, windowSecondaryColor.Z, WindowAlpha);
            style.Colors[(int)ImGuiCol.TextSelectedBg] = new(0.28f, 0.28f, 0.28f, WindowAlpha);
            style.Colors[(int)ImGuiCol.DragDropTarget] = new(0.84f, 0.84f, 0.84f, WindowAlpha);
            style.Colors[(int)ImGuiCol.NavCursor] = new(0.84f, 0.84f, 0.84f, WindowAlpha);
            style.Colors[(int)ImGuiCol.NavWindowingHighlight] = new(0.84f, 0.84f, 0.84f, WindowAlpha);
            style.Colors[(int)ImGuiCol.NavWindowingDimBg] = new(0.0f, 0.0f, 0.0f, 0.4f);
            style.Colors[(int)ImGuiCol.ModalWindowDimBg] = new(0.0f, 0.0f, 0.0f, 0.4f);
            style.Colors[(int)ImGuiCol.CheckMark] = TextCol;
            style.Colors[(int)ImGuiCol.SliderGrab] = TextCol;
            style.Colors[(int)ImGuiCol.SliderGrabActive] = new(0.35f, 0.95f, 0.75f, WindowAlpha);
            style.Colors[(int)ImGuiCol.ButtonHovered] = new(0.12f, 0.29f, 0.25f, WindowAlpha);
            style.Colors[(int)ImGuiCol.ButtonActive] = new(0.15f, 0.38f, 0.31f, WindowAlpha);
        }

        public static void ApplyStyles()
        {
            var style = ImGui.GetStyle();
            ApplyStyles(style);
        }

        public static void ApplyStyles(ImGuiStylePtr style)
        {
            style.Alpha = WindowAlpha;
            style.DisabledAlpha = 0.8f;
            style.WindowPadding = new Vector2(0.0f, 0.0f);
            style.WindowRounding = 6.0f;
            style.WindowBorderSize = 2.0f;
            style.WindowMinSize = new Vector2(32.0f, 32.0f);
            style.WindowTitleAlign = new Vector2(0.5f, 0.5f);
            style.WindowMenuButtonPosition = ImGuiDir.Left;
            style.ChildRounding = 0f;
            style.ChildBorderSize = 1f;
            style.PopupRounding = 4f;
            style.PopupBorderSize = 1.0f;
            style.FramePadding = new Vector2(5.0f, 1.0f);
            style.FrameRounding = 5.0f;
            style.FrameBorderSize = 1.0f;
            style.ItemSpacing = new Vector2(6.0f, 4.0f);
            style.ItemInnerSpacing = new Vector2(4.0f, 4.0f);
            style.CellPadding = new Vector2(4.0f, 2.0f);
            style.IndentSpacing = 21f;
            style.ColumnsMinSpacing = 6f;
            style.ScrollbarSize = 13f;
            style.ScrollbarRounding = 16f;
            style.GrabMinSize = 20f;
            style.GrabRounding = 5f;
            style.TabRounding = 4f;
            style.TabBorderSize = 1f;
            style.TabMinWidthForCloseButton = 0;
            style.ColorButtonPosition = ImGuiDir.Right;
            style.ButtonTextAlign = new Vector2(0.5f, 0.5f);
            style.SelectableTextAlign = new Vector2(0.0f, 0.0f);
            style.ScrollbarSize = 10f;
            style.ScrollbarRounding = 4f;

            ApplyColors();
        }

        private void RenderMainWindow()
        {
            if (User32.GetKeyPressed(OpenKeyInt))
                DrawWindow = !DrawWindow;

            BgDrawList = ImGui.GetBackgroundDrawList();
            if (DrawWindow)
            {
                ImGUI.Widgets.Preview.DrawWindow();
                BgDrawList.AddRectFilled(Vector2.Zero, ScreenSize, ImGui.ColorConvertFloat4ToU32(new Vector4(0f, 0f, 0f, 0.5f))); // ts the dimmed background TODO: make a opacity changer
                DrawParticles(NumberOfParticles);
                ImGui.SetNextWindowPos(new Vector2((ScreenSize.X - MainWindowSize.X) / 2f, (ScreenSize.Y - MainWindowSize.Y) / 2f),
                    ImGuiCond.Always);
                // Set the size before Begin so the viewport and clipping rectangle use it immediately.
                ImGui.SetNextWindowSize(MainWindowSize, ImGuiCond.Always);

                ImGui.PushStyleVar(ImGuiStyleVar.WindowPadding, Vector2.Zero);
                ImGui.Begin("legitbaratinho.xyz",
                    ImGuiWindowFlags.NoResize | ImGuiWindowFlags.NoCollapse | ImGuiWindowFlags.NoTitleBar |
                    ImGuiWindowFlags.NoDocking | ImGuiWindowFlags.NoSavedSettings);

                Vector2 tabPos = ImGui.GetCursorScreenPos();
                var availableSpace = ImGui.GetContentRegionAvail();
                var availableHeight = availableSpace.Y;
                var availableWidth = availableSpace.X;

                TabSize = new(190, ImGui.GetContentRegionAvail().Y);
                ImGui.GetWindowDrawList().AddRectFilled(tabPos, tabPos + TabSize, ImGui.ColorConvertFloat4ToU32(new(0.06f, 0.09f, 0.105f, WindowAlpha)), 12.0f,
                    ImDrawFlags.RoundCornersLeft);

                ImGui.BeginChild("Sidebar", TabSize, ImGuiChildFlags.None);
                {
                    ImGui.SetCursorPos(new Vector2(18, 28));
                    ImGui.TextColored(TextCol, "LEGIT");
                    ImGui.SetCursorPosX(18);
                    ImGui.TextDisabled("MENU / CS2");
                    ImGui.Dummy(new Vector2(0, 24));
                    ImGui.Spacing();

                    ImGui.Separator();
                    ImGui.Spacing();

                    RenderTabButton("\uF53B", "Geral", 0);
                    RenderTabButton("\uF15E", "Visuais", 2);
                    RenderTabButton("\uF1BC", "Mira", 1);
                    RenderTabButton("\uF35A", "Perfis", 3);
                    RenderTabButton("\uF0C0", "Comunidade", 5);
                    RenderTabButton("\uF3DC", "Ajustes", 4);

                    const float cogButtonHeight = 35f;
                    var spacingHeight = ImGui.GetContentRegionAvail().Y - cogButtonHeight - 5f;

                    if (spacingHeight > 0)
                        ImGui.Dummy(new(0, spacingHeight));


                    Vector2 cogPos = ImGui.GetCursorScreenPos();
                    Vector2 cogSize = new(ImGui.GetContentRegionAvail().X, cogButtonHeight);

                    if (ImGui.InvisibleButton("##SettingsGear", cogSize))
                        _selectedTab = 4;


                    bool isHovered = ImGui.IsItemHovered();
                    bool isSettingsSelected = _selectedTab == 4;
                    Vector2 gearCenter = new(cogPos.X + cogSize.X / 2, cogPos.Y + cogSize.Y / 2);

                    uint gearColor;
                    if (isSettingsSelected)
                        gearColor = ImGui.ColorConvertFloat4ToU32(MenuColors.SecondaryRGB ? Colors.Rgb(WindowAlpha) : Renderer.MenuColors.SecondaryColor);

                    else if (isHovered)
                        gearColor = ImGui.ColorConvertFloat4ToU32(new Vector4(0.9f, 0.9f, 0.9f, 1));

                    else
                        gearColor = ImGui.ColorConvertFloat4ToU32(new Vector4(0.6f, 0.6f, 0.6f, 1));


                    DrawGearIcon(gearCenter, gearColor);
                }
                ImGui.EndChild();

                ImGui.SameLine(0f, 0f);

                Vector2 mainPos = ImGui.GetCursorScreenPos();
                Vector2 mainSize = ImGui.GetContentRegionAvail();

                ImGui.GetWindowDrawList().AddRectFilled(mainPos, mainPos + mainSize,
                    ImGui.ColorConvertFloat4ToU32(MenuColors.PrimaryColor), 12.0f,
                    ImDrawFlags.RoundCornersBottom);

                ImGui.PopStyleVar();
                ImGui.PushStyleVar(ImGuiStyleVar.WindowPadding, new Vector2(16, 16));
                ImGui.PushStyleVar(ImGuiStyleVar.ChildRounding, 12.0f);
                ImGui.BeginChild("MainContent", mainSize, ImGuiChildFlags.AlwaysUseWindowPadding, ImGuiWindowFlags.NoBackground);
                {
                    ImGui.SetCursorPos(new Vector2(18, 18));
                    ImGui.TextColored(
                        TextCol,
                        new[]
                        {
                            "Geral",
                            "Mira",
                            "Visuais",
                            "Perfis",
                            "Ajustes",
                            "Configs da comunidade"
                        }[_selectedTab]);
                    ImGui.SameLine();
                    ImGui.TextDisabled(" / legitbaratinho.xyz");
                    ImGui.Separator();
                    switch (_selectedTab)
                    {
                        case 0:
                        case 1:
                        case 2:
                            ImGui.Dummy(new Vector2(0, 4));
                            float availW = ImGui.GetContentRegionAvail().X;
                            float sectionW = (availW - ImGui.GetStyle().ItemSpacing.X) / 2f - 4f;
                            float leftX = ImGui.GetCursorPosX() + 4f;
                            float rightX = leftX + sectionW + ImGui.GetStyle().ItemSpacing.X;
                            float startY = ImGui.GetCursorPosY();

                            var tabSections = Sections.sections.Where(s => s.tab == _selectedTab).ToList();
                            var leftSections = tabSections.Where((_, i) => i % 2 == 0).ToList();
                            var rightSections = tabSections.Where((_, i) => i % 2 != 0).ToList();

                            float curY = startY;
                            foreach (var s in leftSections)
                            {
                                ImGui.SetCursorPos(new Vector2(leftX, curY));
                                Sections.BeginSection(s.label, s.content, new Vector2(sectionW, 0));
                                curY = ImGui.GetCursorPosY() + 4f;
                            }
                            float leftColBottom = curY;

                            curY = startY;
                            foreach (var s in rightSections)
                            {
                                ImGui.SetCursorPos(new Vector2(rightX, curY));
                                Sections.BeginSection(s.label, s.content, new Vector2(sectionW, 0));
                                curY = ImGui.GetCursorPosY() + 4f;
                            }
                            float rightColBottom = curY;

                            ImGui.SetCursorPosY(Math.Max(leftColBottom, rightColBottom));
                            // Submit an item after moving the cursor so ImGui records the layout extent.
                            ImGui.Dummy(Vector2.Zero);
                            break;

                        case 4: // ajustes
                            ImGui.Dummy(new Vector2(0, 4));
                            float settingsWidth = Math.Min(430f, ImGui.GetContentRegionAvail().X - 8f);
                            ImGui.SetCursorPosX(ImGui.GetCursorPosX() + 4f);
                            Sections.BeginSection("Interface", () =>
                            {
                                ImGui.Checkbox("Exibir atalhos / hotkeys", ref ShowHotkeys);
                                ImGui.Checkbox("Exibir watermark", ref EnableWatermark);
                                ImGui.Checkbox("Stream mode", ref StreamMode);

                                if (StreamMode)
                                {
                                    ImGui.TextDisabled("Overlay oculto de capturas compatíveis.");
                                }
                            }, new Vector2(settingsWidth, 0));
                            break;

                        case 3: // config
                            float availWidth = ImGui.GetContentRegionAvail().X;
                            float wiodthy = (availWidth - ImGui.GetStyle().ItemSpacing.X) / 2f - 6f;
                            ImGui.Dummy(new Vector2(0, 4));
                            ImGui.SetCursorPosX(ImGui.GetCursorPosX() + 4f);

                            Sections.BeginSection("Perfis salvos", () =>
                            {
                                foreach (var config in Configs.SavedConfigs.Keys.OrderBy(x => x))
                                {
                                    ImGui.PushID(config);
                                    if (ImGui.Selectable(config, Configs.SelectedConfig == config))
                                        Configs.SelectedConfig = config;
                                    ImGui.PopID();
                                }
                            }, new Vector2(wiodthy, 200));

                            ImGui.SameLine();

                            Sections.BeginSection("Gerenciar perfil", () =>
                            {
                                ImGui.SetNextItemWidth(-1);
                                ImGui.InputText("##ConfigName", ref Configs.SelectedConfig, 24);
                                ImGui.Dummy(new Vector2(0, 4));

                                if (ImGui.Button("Salvar perfil", new Vector2(-1, 30)))
                                {
                                    string configName = Configs.SelectedConfig.Trim();
                                    if (!string.IsNullOrWhiteSpace(configName))
                                    {
                                        Configs.SaveConfig(configName);
                                        Configs.SelectedConfig = configName.EndsWith(".json", StringComparison.OrdinalIgnoreCase)
                                            ? configName
                                            : configName + ".json";
                                    }
                                }

                                if (ImGui.Button("Carregar perfil", new Vector2(-1, 30)))
                                {
                                    if (!string.IsNullOrEmpty(Configs.SelectedConfig))
                                        Configs.LoadConfig(Configs.SelectedConfig);

                                    Sections.sections.Clear();
                                    Sections.sections = Sections.InitializeSections(); // we re-init sections because all the refs would be pointing to the old values.
                                }
                                if (ImGui.Button("Excluir perfil", new Vector2(-1, 30)))
                                {
                                    try
                                    {
                                        if (string.IsNullOrEmpty(Configs.SelectedConfig) || !Configs.SavedConfigs.ContainsKey(Configs.SelectedConfig))
                                            return;

                                        string configName = Configs.SelectedConfig.EndsWith(".json", StringComparison.OrdinalIgnoreCase)
                                            ? Configs.SelectedConfig
                                            : Configs.SelectedConfig + ".json";
                                        string filePath = Path.Combine(Configs.ConfigDirPath, configName);
                                        Console.WriteLine(filePath);
                                        if (!File.Exists(filePath))
                                            return;

                                        File.Delete(filePath);
                                        Configs.SavedConfigs.Remove(Configs.SelectedConfig, out _);
                                        Configs.SelectedConfig = "";
                                    }
                                    catch (Exception ex)
                                    {
                                        Console.WriteLine("Exception deleting config: " + ex);
                                    }
                                }
                            }, new Vector2(wiodthy, 200));

                            break;

                        case 5: // configs da comunidade
                            ImGui.Dummy(new Vector2(0, 4));
                            CommunityConfigs.Draw();
                            break;
                    }
                    ImGui.PopStyleVar(2);
                }
                ImGui.EndChild();

                ImGui.End();
            }

            bool cs2Focused = User32.IsWindowFocused(CS2ProcessId);
            bool overlayFocused = OverlayProcessId != 0 && User32.IsWindowFocused(OverlayProcessId);

            if (cs2Focused || overlayFocused)
                RunAllModules();
        }

        public void DrawParticles(int num)
        {
            var circleColor = BackgroundEffectColors.PrimaryRGB ? Colors.Rgb(BackgroundEffectColors.PrimaryColor.W) : BackgroundEffectColors.PrimaryColor;
            var lineColor = BackgroundEffectColors.SecondaryRGB ? Colors.Rgb(BackgroundEffectColors.SecondaryColor.W) : BackgroundEffectColors.SecondaryColor;
            while (Positions.Count < num || Velocities.Count < num) // only add if there isnt eg 50 drawn
            {
                Positions.Add(new Vector2(Random.Next((int)ScreenSize.X), Random.Next((int)ScreenSize.Y)));
                Velocities.Add(new Vector2((float)(Random.NextDouble() * 2 - 1), (float)(Random.NextDouble() * 2 - 1)));
            }

            for (int i = 0; i < num; i++)
            {
                Positions[i] += Velocities[i] * ParticleSpeed;

                if (Positions[i].X < 0 || Positions[i].X > ScreenSize.X || Positions[i].Y < 0 ||
                    Positions[i].Y > ScreenSize.Y)
                {
                    Positions[i] = new Vector2(Random.Next((int)ScreenSize.X), Random.Next((int)ScreenSize.Y));
                    Velocities[i] = new Vector2((float)(Random.NextDouble() * 2 - 1),
                        (float)(Random.NextDouble() * 2 - 1));
                }

                GlowRenderer.DrawGlowCircleFilled(DrawList, Positions[i], ParticleRadius, circleColor, 1.1f);
            }

            for (int i = 0; i < num; i++) // lines
            {
                for (int j = i + 1; j < num; j++)
                {
                    float dist = Vector2.Distance(Positions[i], Positions[j]);
                    if (dist < MaxLineDistance)
                    {
                        float alpha = 1f - (dist / MaxLineDistance);
                        DrawList.AddLine(Positions[i], Positions[j],
                            ImGui.ColorConvertFloat4ToU32(new Vector4(lineColor.X, lineColor.Y, lineColor.Z,
                                lineColor.W * alpha)), 1f);
                    }
                }
            }
        }

        public void RunAllModules()
        {
            try
            {
                if (Aimbot.AimbotEnable && Aimbot.TargetLine)
                    Aimbot.RenderTargetLine();

                _chamsRenderer.RenderFrame();
                _worldChamsRenderer.RenderFrame();
                HitStuff.CreateHitText();

                if (EyeRay.Enabled)
                    EyeRay.DrawEyeRay();
                BulletTracers.Render();

                List<Entity> snapshot;
                lock (_entityLock)
                    snapshot = Entities;

                foreach (var entity in snapshot)
                {
                    if (entity == null)
                        continue;

                    Modules.Visual.BoneESP.DrawBoneLines(entity, this);
                    NameDisplay.DrawName(entity, this);
                    PingDisplay.DrawPing(entity, this);
                    BoxESP.DrawBoxESP(entity);
                    Mac1ota_Menu.Modules.Visual.DistanceText.DrawDistance(entity);
                    Tracers.DrawTracers(entity, this);

                    var rect = BoxESP.GetBoxRect(entity);
                    if (rect == null)
                        continue;

                    HealthBar.DrawHealthBar(entity, entity.Health, 100, rect);
                    ArmorBar.DrawArmorBar(entity, this, entity.Armor, 100, rect);
                    Flags.DrawFlags(entity);
                }

                if (GernadeLineup.Enabled)
                    GernadeLineup.DrawAllLineups();

                if (Aimbot.DrawFov && Aimbot.AimbotEnable && Aimbot.UseFOV)
                    Aimbot.DrawFOVCircle(Aimbot.FovSize, Aimbot.RGB ? Colors.Rgb(Aimbot.FovColor.W) : Aimbot.FovColor);

                if (C4ESP.Enabled)
                {
                    C4ESP.DrawESP();
                }

                WorldESP.EntityESP();
                Radar.DrawRadar();

                SoundESP.Draw();

                if (MenuColors.PrimaryRGB || MenuColors.SecondaryRGB)
                    ApplyColors();
            }
            catch (Exception e)
            {
                Console.WriteLine(e);
            }
        }

        private static void DrawGearIcon(Vector2 center, uint color)
        {

            ImGui.PushFont(IconFont);

            Vector2 textSize = ImGui.CalcTextSize("\uF3DC");
            Vector2 textPos = new(center.X - textSize.X / 2, center.Y - textSize.Y / 2);

            ImGui.GetWindowDrawList().AddText(textPos, color, "\uF3DC");

            ImGui.PopFont();
        }


        private void RenderTabButton(string icon, string label, int tabIndex)
        {
            bool selected = _selectedTab == tabIndex;
            bool pressed = ImGui.InvisibleButton(label, new Vector2(TabSize.X, 46));
            Vector2 pos = ImGui.GetItemRectMin();
            Vector2 size = ImGui.GetItemRectSize();
            var draw = ImGui.GetWindowDrawList();
            if (selected || ImGui.IsItemHovered())
                draw.AddRectFilled(pos + new Vector2(8, 3), pos + size - new Vector2(8, 3),
                    ImGui.ColorConvertFloat4ToU32(new Vector4(0.12f, 0.25f, 0.22f, selected ? 1f : 0.5f)), 8f);
            if (selected)
                draw.AddRectFilled(pos + new Vector2(8, 12), pos + new Vector2(11, 34), ImGui.ColorConvertFloat4ToU32(TextCol), 2f);
            bool hasFont = IsIconFontLoaded;
            if (hasFont) ImGui.PushFont(IconFont);
            var iconSize = ImGui.CalcTextSize(icon);
            draw.AddText(pos + new Vector2(20, (size.Y - iconSize.Y) / 2), ImGui.ColorConvertFloat4ToU32(selected ? TextCol : new Vector4(0.6f, 0.7f, 0.7f, 1f)), icon);
            if (hasFont) ImGui.PopFont();
            var textSize = ImGui.CalcTextSize(label);
            draw.AddText(pos + new Vector2(54, (size.Y - textSize.Y) / 2), ImGui.GetColorU32(ImGuiCol.Text), label);
            if (pressed)
            {
                _selectedTab = tabIndex;
                PlayTabClickSound();
            }
        }
        public static void PlayTabClickSound()
        {
            if (!MenuSounds)
                return;

            Classes.PlaySound.PlaySoundFileEmbedded("Creamy.wav", "ClickSounds.", MenuSoundsVolume);
        }

        public static void RenderSettingsSection(string label, Action content)
        {
            ImGui.PushStyleVar(ImGuiStyleVar.ItemSpacing, new Vector2(0, 4));
            ImGui.Indent(5f);
            ImGui.Text(label);

            ImGui.Indent(21f);
            content();
            ImGui.Unindent(16f);

            ImGui.PopStyleVar();
        }
    }
}
