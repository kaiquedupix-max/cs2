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

    GameState.memory = new("cs2");
    GameState.client = GameState.memory.GetModuleBase("client.dll");
    await Task.Delay(200);
    await OffsetGetter.UpdateOffsetsAsync();

    while (GameState.memory != null && !OffsetGetter.Updated)
    {
        if (GameState.CS2Open())
        {
            Process[] cs2 = GameState.GetCS2Process();
            Renderer.CS2ProcessId = cs2.FirstOrDefault()?.Id ?? 0;
            Process[] overlay = Process.GetProcessesByName("Mac1ota Menu");
            Renderer.OverlayProcessId = overlay.FirstOrDefault()?.Id ?? 0;

            await OffsetGetter.CheckIfOffsetsAreValid();
        }
        await Task.Delay(500);
    }

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

    ThreadService.StartAllThreadServices();
    Mac1ota_Menu.Classes.DiscordRPC.DiscordRPC.Update();
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

