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

        "legitbaratinho.xyz",
        "CS2",
        "External",
        "Map Data",
        "tri");

async Task ConnectToCs2Async(
    bool updateStartup)
{
    while (true)
    {
        while (!GameState.CS2Open())
        {
            GameState.ResetConnection();

            if (updateStartup)
            {
                LoaderForm.SetStartupProgress(
                    100,
                    "Aguardando CS2...");
            }

            await Task.Delay(
                500);
        }

        Process? cs2Process =
            GameState
                .GetCS2Process()
                .FirstOrDefault();

        if (cs2Process == null)
        {
            await Task.Delay(
                250);

            continue;
        }

        try
        {
            Renderer.CS2ProcessId =
                cs2Process.Id;

            Renderer.OverlayProcessId =
                Environment.ProcessId;

            if (updateStartup)
            {
                LoaderForm.SetStartupProgress(
                    20,
                    "Conectando ao CS2...");
            }

            GameState.memory =
                new("cs2");

            GameState.client =
                IntPtr.Zero;

            DateTime moduleDeadline =
                DateTime.UtcNow
                    .AddSeconds(
                        30);

            while (
                DateTime.UtcNow <
                    moduleDeadline)
            {
                if (cs2Process.HasExited)
                {
                    break;
                }

                GameState.client =
                    GameState.memory
                        .GetModuleBase(
                            "client.dll");

                if (GameState.client !=
                    IntPtr.Zero)
                {
                    break;
                }

                if (updateStartup)
                {
                    LoaderForm.SetStartupProgress(
                        25,
                        "Aguardando client.dll...");
                }

                await Task.Delay(
                    250);

                cs2Process.Refresh();
            }

            if (GameState.client ==
                    IntPtr.Zero ||
                cs2Process.HasExited)
            {
                GameState.ResetConnection();

                await Task.Delay(
                    500);

                continue;
            }

            if (updateStartup)
            {
                LoaderForm.SetStartupProgress(
                    40,
                    "Atualizando dados...");
            }

            OffsetGetter.Updated =
                false;

            await OffsetGetter
                .UpdateOffsetsAsync();

            DateTime validationDeadline =
                DateTime.UtcNow
                    .AddSeconds(
                        20);

            while (
                DateTime.UtcNow <
                    validationDeadline)
            {
                if (!GameState.IsConnectedToCS2())
                {
                    break;
                }

                if (updateStartup)
                {
                    LoaderForm.SetStartupProgress(
                        65,
                        "Validando EntityList...");
                }

                await OffsetGetter
                    .CheckIfOffsetsAreValid();

                IntPtr entityList =
                    GameState.memory!
                        .ReadPointer(
                            GameState.client +
                            Offsets.dwEntityList);

                if (entityList !=
                    IntPtr.Zero)
                {
                    GameState.EntityList =
                        entityList;

                    return;
                }

                OffsetGetter.Updated =
                    false;

                await Task.Delay(
                    500);
            }
        }
        catch (Exception ex)
        {
            Console.WriteLine(
                "[CS2 CONNECT] " +
                ex.Message);
        }

        GameState.ResetConnection();

        await Task.Delay(
            500);
    }
}

int cs2StoppedHandled =
    0;

void TerminateBecauseCs2Stopped()
{
    if (Interlocked.Exchange(
            ref cs2StoppedHandled,
            1) !=
        0)
    {
        return;
    }

    try
    {
        GameState.ResetConnection();

        System.Windows.Forms
            .MessageBox
            .Show(
                "O legitbaratinho.xyz foi finalizado porque o processo do CS2 parou.",

                "legitbaratinho.xyz",

                System.Windows.Forms
                    .MessageBoxButtons.OK,

                System.Windows.Forms
                    .MessageBoxIcon.Information);
    }
    finally
    {
        System.Windows.Forms
            .Application
            .Exit();

        Environment.Exit(
            0);
    }
}

if (!LoaderForm.ShowLogin())
{
    return;
}

if (!ProductSelectionForm.ShowSelection())
{
    ClientPortalApi.Clear();
    return;
}

try
{
    LoaderForm.ShowStartup();

    LoaderForm.SetStartupProgress(
        5,
        "Aguardando CS2...");

    List<Entity> entities =
        [];

    // Não cria nem inicia a overlay enquanto o CS2 estiver fechado.
    // Primeiro aguardamos o processo, client.dll e EntityList válidos.
    await ConnectToCs2Async(
        true);

    Thread cs2ProcessWatcher =
        new(() =>
        {
            while (true)
            {
                Thread.Sleep(
                    500);

                if (!GameState.CS2Open())
                {
                    TerminateBecauseCs2Stopped();
                    return;
                }
            }
        })
        {
            IsBackground =
                true,

            Name =
                "CS2 process watcher"
        };

    cs2ProcessWatcher.Start();

    LoaderForm.SetStartupProgress(
        72,
        "Inicializando interface...");

    GameState.renderer =
        new();

    ImGui.CreateContext();

    Renderer.LoadFonts();

    Mac1ota_Menu
        .Classes
        .DiscordRPC
        .DiscordRPC
        .Initialize();

    LoaderForm.SetStartupProgress(
        78,
        "Preparando overlay...");

    await GameState.renderer.Start();

    GernadeLineup.Initialize();

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
            int consecutiveInvalidEntityLists =
                0;

            while (true)
            {
                try
                {
                    if (!GameState.IsConnectedToCS2())
                    {
                        entities =
                            [];

                        GameState.renderer!
                            .UpdateEntities(
                                entities);

                        GameState.Entities =
                            [];

                        ConnectToCs2Async(
                                false)
                            .GetAwaiter()
                            .GetResult();

                        consecutiveInvalidEntityLists =
                            0;

                        Thread.Sleep(
                            50);

                        continue;
                    }

                    entities =
                        EntityManager
                            .GetEntities();

                    if (GameState.EntityList ==
                        IntPtr.Zero)
                    {
                        consecutiveInvalidEntityLists++;
                    }
                    else
                    {
                        consecutiveInvalidEntityLists =
                            0;
                    }

                    if (consecutiveInvalidEntityLists >=
                        250)
                    {
                        Console.WriteLine(
                            "[CS2 CONNECT] EntityList inválida. Reconectando...");

                        GameState.ResetConnection();

                        consecutiveInvalidEntityLists =
                            0;

                        continue;
                    }

                    GameState.renderer!
                        .UpdateEntities(
                            entities);

#pragma warning disable CS8619

                    GameState.Entities =
                        entities;

#pragma warning restore CS8619

                    Thread.Sleep(
                        1);
                }
                catch (Exception ex)
                {
                    Console.WriteLine(
                        "[ENTITY LOOP] " +
                        ex.Message);

                    if (!GameState.CS2Open())
                    {
                        GameState.ResetConnection();
                    }

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
            "Não foi possível iniciar o legitbaratinho.xyz.\nVerifique se o CS2 está aberto.",

            "legitbaratinho.xyz",

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
            "Erro ao iniciar o legitbaratinho.xyz:\n\n" +
            e.Message,

            "legitbaratinho.xyz",

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
