using ImGuiNET;
using System.Diagnostics;
using System.Reflection;
using System.Runtime.InteropServices;
using Mac1ota_Menu;
using Mac1ota_Menu.Classes;
using Mac1ota_Menu.Data.Entity;
using Mac1ota_Menu.Data.Game;
using Mac1ota_Menu.Data.Game.MapParser;
using Mac1ota_Menu.Modules;
using Mac1ota_Menu.Modules.Visual;

ConsoleWindowHelper.Hide();

string triPath =
    Path.Combine(
        Environment.GetFolderPath(
            Environment.SpecialFolder.MyDocuments),

        "Mac1ota Menu",
        "CS2",
        "External",
        "Map Data",
        "tri");

if (!LoaderForm.ShowLogin())
{
    return;
}

try
{
    LoaderForm.ShowStartup();

    LoaderForm.SetStartupProgress(
        5,
        "Inicializando interface...");

    GameState.renderer =
        new();

    EntityManager entityManager =
        new();

    ImGui.CreateContext();

    Renderer.LoadFonts();

    Mac1ota_Menu
        .Classes
        .DiscordRPC
        .DiscordRPC
        .Initialize();

    LoaderForm.SetStartupProgress(
        12,
        "Preparando ambiente...");

    await GameState.renderer.Start();

    GernadeLineup.Initialize();

    List<Entity>? entities =
        [];

    while (!GameState.CS2Open())
    {
        LoaderForm.SetStartupProgress(
            100,
            "Aguardando CS2...");

        await Task.Delay(
            500);
    }

    LoaderForm.SetStartupProgress(
        20,
        "Conectando ao CS2...");

    GameState.memory =
        new("cs2");

    GameState.client =
        GameState.memory
            .GetModuleBase(
                "client.dll");

    LoaderForm.SetStartupProgress(
        40,
        "Atualizando dados...");

    await Task.Delay(
        250);

    await OffsetGetter
        .UpdateOffsetsAsync();

    const int validationTimeoutSeconds =
        15;

    DateTime validationDeadline =
        DateTime.UtcNow
            .AddSeconds(
                validationTimeoutSeconds);

    while (
        GameState.memory != null &&
        !OffsetGetter.Updated &&
        DateTime.UtcNow <
        validationDeadline)
    {
        if (!GameState.CS2Open())
        {
            LoaderForm.SetStartupProgress(
                100,
                "Aguardando CS2...");

            while (!GameState.CS2Open())
            {
                await Task.Delay(
                    500);
            }
        }

        Process[] cs2 =
            GameState.GetCS2Process();

        Renderer.CS2ProcessId =
            cs2
                .FirstOrDefault()
                ?.Id ?? 0;

        Process[] overlay =
            Process.GetProcessesByName(
                "Mac1ota Menu");

        Renderer.OverlayProcessId =
            overlay
                .FirstOrDefault()
                ?.Id ?? 0;

        LoaderForm.SetStartupProgress(
            65,
            "Atualizando dados...");

        await OffsetGetter
            .CheckIfOffsetsAreValid();

        if (!OffsetGetter.Updated)
        {
            await Task.Delay(
                500);
        }
    }

    if (!OffsetGetter.Updated)
    {
        LoaderForm.SetStartupOffline(
            "OFFLINE - não foi possível atualizar os dados. Abra novamente.");

        while (LoaderForm.StartupVisible)
        {
            await Task.Delay(
                100);
        }

        return;
    }

    LoaderForm.SetStartupProgress(
        82,
        "Sincronizando recursos...");

    OffsetGetter.ApplySecondarySources();

    LoaderForm.SetStartupProgress(
        88,
        "Preparando arquivos...");

    Thread mapDumperThread =
        new(() =>
        {
            Directory.CreateDirectory(
                triPath);

            string sentinelPath =
                Path.Combine(
                    triPath,
                    ".complete");

            if (File.Exists(
                    sentinelPath))
            {
                return;
            }

            MapParser.Main();

            File.WriteAllText(
                sentinelPath,
                DateTime.UtcNow
                    .ToString());
        });

    mapDumperThread.Start();
    mapDumperThread.Join();

    LoaderForm.SetStartupProgress(
        93,
        "Iniciando serviços...");

    Thread entityUpdateThread =
        new(() =>
        {
            while (true)
            {
                try
                {
                    if (entityManager != null)
                    {
                        entities =
                            EntityManager
                                .GetEntities();
                    }

                    if (entities != null)
                    {
                        GameState.renderer
                            .UpdateEntities(
                                entities);

#pragma warning disable CS8619

                        GameState.Entities =
                            entities;

#pragma warning restore CS8619
                    }

                    Thread.Sleep(
                        1);
                }
                catch
                {
                    Thread.Sleep(
                        50);
                }
            }
        })
        {
            IsBackground =
                true,

            Priority =
                ThreadPriority.Highest
        };

    entityUpdateThread.Start();

    LoaderForm.SetStartupProgress(
        97,
        "Finalizando inicialização...");

    ThreadService
        .StartAllThreadServices();

    Mac1ota_Menu
        .Classes
        .DiscordRPC
        .DiscordRPC
        .Update();

    LoaderForm.SetStartupProgress(
        100,
        "Tudo pronto.");

    await Task.Delay(
        550);

    LoaderForm.CloseStartup();

    while (true)
    {
        Thread.Sleep(
            20);
    }
}
catch (IndexOutOfRangeException)
{
    LoaderForm.SetStartupOffline(
        "Não foi possível iniciar. Verifique o CS2.");

    System.Windows.Forms
        .MessageBox
        .Show(
            "Não foi possível iniciar o Mac1ota Menu.\nVerifique se o CS2 está aberto.",

            "Mac1ota Menu",

            System.Windows.Forms
                .MessageBoxButtons.OK,

            System.Windows.Forms
                .MessageBoxIcon.Warning);
}
catch (Exception e)
{
    LoaderForm.SetStartupOffline(
        "Falha durante a inicialização.");

    System.Windows.Forms
        .MessageBox
        .Show(
            "Erro ao iniciar o Mac1ota Menu:\n\n" +
            e.Message,

            "Mac1ota Menu",

            System.Windows.Forms
                .MessageBoxButtons.OK,

            System.Windows.Forms
                .MessageBoxIcon.Error);
}

internal static class ConsoleWindowHelper
{
    private const int SW_HIDE =
        0;

    public static void Hide()
    {
        IntPtr console =
            GetConsoleWindow();

        if (console !=
            IntPtr.Zero)
        {
            ShowWindow(
                console,
                SW_HIDE);
        }
    }

    [DllImport("kernel32.dll")]
    private static extern IntPtr
        GetConsoleWindow();

    [DllImport("user32.dll")]
    private static extern bool
        ShowWindow(
            IntPtr hWnd,
            int nCmdShow);
}