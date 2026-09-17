using ImGuiNET;
using System.Diagnostics;
using System.Reflection;
using Mac1ota_Menu;
using Mac1ota_Menu.Classes;
using Mac1ota_Menu.Data.Entity;
using Mac1ota_Menu.Data.Game;
using Mac1ota_Menu.Data.Game.MapParser;
using Mac1ota_Menu.Modules;
using Mac1ota_Menu.Modules.Visual;

string triPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.MyDocuments), "Mac1ota Menu", "CS2", "External", "Map Data", "tri");

if (!LoaderForm.ShowLogin())
    return;
try
{
    GameState.renderer = new();
    EntityManager entityManager = new();
    ImGui.CreateContext();
    Renderer.LoadFonts();
    Mac1ota_Menu.Classes.DiscordRPC.DiscordRPC.Initialize();
    await GameState.renderer.Start();
    GernadeLineup.Initialize();

    // entities
    List<Entity>? entities = [];
    while (!GameState.CS2Open())
    {
        Console.WriteLine("CS2 não encontrado...");
        Thread.Sleep(1000);
    }

    LoaderForm.ShowStartup();
    LoaderForm.SetStartupProgress(20, "Conectando ao CS2...");

    GameState.memory = new("cs2");
    GameState.client = GameState.memory.GetModuleBase("client.dll");
    LoaderForm.SetStartupProgress(40, "Carregando offsets...");
    await Task.Delay(200);
    await OffsetGetter.UpdateOffsetsAsync();

    const int offsetValidationTimeoutSeconds = 15;
    DateTime offsetValidationDeadline = DateTime.UtcNow.AddSeconds(offsetValidationTimeoutSeconds);

    while (GameState.memory != null && !OffsetGetter.Updated && DateTime.UtcNow < offsetValidationDeadline)
    {
        if (!GameState.CS2Open())
            break;

        Process[] cs2 = GameState.GetCS2Process();
        Renderer.CS2ProcessId = cs2.FirstOrDefault()?.Id ?? 0;
        Process[] overlay = Process.GetProcessesByName("Mac1ota Menu");
        Renderer.OverlayProcessId = overlay.FirstOrDefault()?.Id ?? 0;

        int secondsLeft = Math.Max(0, (int)Math.Ceiling((offsetValidationDeadline - DateTime.UtcNow).TotalSeconds));
        LoaderForm.SetStartupProgress(65, $"Validando offsets... ({secondsLeft}s)");
        await OffsetGetter.CheckIfOffsetsAreValid();

        if (!OffsetGetter.Updated)
            await Task.Delay(500);
    }

    if (!OffsetGetter.Updated)
    {
        LoaderForm.SetStartupOffline("OFFLINE - não foi possível carregar os offsets. Tente abrir novamente.");
        while (LoaderForm.StartupVisible)
            await Task.Delay(100);
        return;
    }

    LoaderForm.SetStartupProgress(85, "Aplicando offsets...");
    OffsetGetter.ApplySecondarySources();
    Thread mapDumperThread = new(() =>
    {
        Directory.CreateDirectory(triPath);
        string sentinelPath = Path.Combine(triPath, ".complete");
        if (File.Exists(sentinelPath))
        {
            Console.WriteLine("Dados triangulares já existem.");
            return;
        }

        Console.WriteLine("Extraindo os dados do mapa.");
        MapParser.Main();
        File.WriteAllText(sentinelPath, DateTime.UtcNow.ToString());
    });
    mapDumperThread.Start();
    mapDumperThread.Join();

    Thread entityUpdateThread = new(() =>
     {
         while (true)
         {
             try
             {
                 if (entityManager != null)
                 {
                     entities = EntityManager.GetEntities();
                 }
                 if (entities != null)
                 {
                     GameState.renderer.UpdateEntities(entities);
#pragma warning disable CS8619 // Nullability of reference types in value doesn't match target type.
                     GameState.Entities = entities;
#pragma warning restore CS8619 // Nullability of reference types in value doesn't match target type.
                 }

                 Thread.Sleep(1);
             }
             catch (Exception e)
             {
                 Console.WriteLine("Erro na atualização das entidades: " + e.StackTrace);
             }
         }
     })
    {
        IsBackground = true,
        Priority = ThreadPriority.Highest
    };
    entityUpdateThread.Start();

    LoaderForm.SetStartupProgress(95, "Iniciando serviços...");
    ThreadService.StartAllThreadServices();
    Mac1ota_Menu.Classes.DiscordRPC.DiscordRPC.Update();
    LoaderForm.SetStartupProgress(100, "Mac1ota Menu iniciado.");
    await Task.Delay(350);
    LoaderForm.CloseStartup();
    while (true)
    {
        Thread.Sleep(20);
    }
}
catch (IndexOutOfRangeException)
{
    Console.WriteLine("Índice fora dos limites. Verifique se o jogo está aberto.");
}
catch (Exception e)
{
    Console.WriteLine("Erro na função principal: " + e.Message);
}

