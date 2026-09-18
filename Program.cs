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

async Task<bool> ConnectToCs2Async(
    bool updateStartup)
{
    while (true)
    {
        bool connected =
        await ConnectToCs2Async(
            true);

    if (!connected)
    {
        LoaderForm.SetStartupOffline(
            "OFFLINE - não foi possível conectar ao CS2. Tentando novamente ao reiniciar.");

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
            int consecutiveEmptyEntityLists =
                0;

            while (true)
            {
                try
                {
                    if (!GameState.IsConnectedToCS2())
                    {
                        entities = [];

                        GameState.renderer
                            .UpdateEntities(
                                entities);

                        GameState.Entities =
                            [];

                        ConnectToCs2Async(
                                false)
                            .GetAwaiter()
                            .GetResult();

                        consecutiveEmptyEntityLists =
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
                        consecutiveEmptyEntityLists++;
                    }
                    else
                    {
                        consecutiveEmptyEntityLists =
                            0;
                    }

                    if (consecutiveEmptyEntityLists >
                        250)
                    {
                        Console.WriteLine(
                            "[CS2 CONNECT] EntityList inválida. Reconectando...");

                        GameState.ResetConnection();

                        consecutiveEmptyEntityLists =
                            0;

                        continue;
                    }

                    GameState.renderer
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