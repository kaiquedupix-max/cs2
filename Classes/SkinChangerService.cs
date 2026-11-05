using Mac1ota_Menu.Data.Game;

namespace Mac1ota_Menu.Classes;

internal static class SkinChangerService
{
    private sealed record Selection(ushort Weapon, int Paint, int Seed, float Wear, bool Legacy, long Revision);
    private static readonly object Gate = new();
    private static readonly Dictionary<ushort, Selection> Selections = new();
    private static Task? worker;
    private static long revision;
    private static int blockedProcess;
    private static volatile string status = "Escolha uma skin e clique em Aplicar.";
    internal static string Status => status;
    internal static volatile bool Enabled = true;

    internal static void Select(ushort weapon, int paint, int seed, float wear, bool legacy)
    {
        if (blockedProcess != 0 && blockedProcess == Renderer.CS2ProcessId)
            throw new InvalidOperationException("Reinicie o CS2 após o tempo limite de materiais.");
        _ = SkinMaterialData.Attributes(paint, seed, wear);
        lock (Gate)
        {
            Selections[weapon] = new(weapon, paint, seed, wear, legacy, ++revision);
            Enabled = true;
            status = "Seleção salva nesta sessão. Aguardando a arma equipada...";
            worker ??= Task.Run(RunAsync);
        }
    }

    private static async Task RunAsync()
    {
        SkinMaterialSession? session = null;
        int pid = 0;
        nint client = 0;
        (nint Pawn, uint Handle, nint Weapon, long Revision)? lastAttempt = null;
        try
        {
            while (true)
            {
                await Task.Delay(300);
                if (!Enabled) { lastAttempt = null; continue; }
                try
                {
                    int currentPid = Renderer.CS2ProcessId;
                    if (GameState.client == 0 || currentPid == 0 || !GameState.IsConnectedToCS2())
                    {
                        session?.Dispose(); session = null;
                        lastAttempt = null;
                        status = "Aguardando conexão com o CS2...";
                        continue;
                    }
                    if (currentPid == blockedProcess) continue;
                    if (session == null || currentPid != pid || client != GameState.client)
                    {
                        session?.Dispose(); session = null;
                        pid = currentPid; client = GameState.client;
                        lastAttempt = null;
                        ValidateOffsets();
                        session = new(pid, client);
                        session.ResolveRegenerator();
                    }
                    nint pawn = session.Read<nint>(client + Offsets.dwLocalPlayerPawn);
                    if (pawn == 0 || session.Read<int>(pawn + Offsets.m_iHealth) <= 0) continue;
                    nint services = session.Read<nint>(pawn + Offsets.m_pWeaponServices);
                    if (services == 0) continue;
                    uint handle = session.Read<uint>(services + Offsets.m_hActiveWeapon);
                    nint list = session.Read<nint>(client + Offsets.dwEntityList);
                    nint weapon = session.Entity(list, handle);
                    if (weapon == 0) continue;
                    ushort definition = session.Read<ushort>(weapon + Offsets.m_AttributeManager + Offsets.m_Item + Offsets.m_iItemDefinitionIndex);
                    Selection? selected;
                    lock (Gate) Selections.TryGetValue(definition, out selected);
                    if (selected == null) continue;
                    var attempt = (pawn, handle, weapon, selected.Revision);
                    if (lastAttempt == attempt &&
                        session.Read<int>(weapon + Offsets.m_nFallbackPaintKit) == selected.Paint &&
                        session.Read<int>(weapon + Offsets.m_nFallbackSeed) == selected.Seed &&
                        System.Math.Abs(session.Read<float>(weapon + Offsets.m_flFallbackWear) - selected.Wear) < .001f) continue;
                    lastAttempt = attempt;
                    status = "Reconstruindo os materiais da arma...";
                    int materials = session.Apply(pawn, list, handle, definition, selected.Paint, selected.Seed, selected.Wear, selected.Legacy);
                    status = $"O jogo gerou {materials} material(is) para o paint kit #{selected.Paint}. Textura visual ainda não confirmada.";
                }
                catch (Exception ex)
                {
                    status = ex.Message;
                    // Never repeatedly call a changed/failed engine routine in one process.
                    if (session?.TimedOut == true) blockedProcess = pid;
                    session?.Dispose(); session = null;
                    Enabled = false;
                }
            }
        }
        finally { session?.Dispose(); }
    }

    private static void ValidateOffsets()
    {
        if (Offsets.m_iAttributeDefinitionIndex != 0x30 || Offsets.m_flValue != 0x34 || Offsets.m_flInitialValue != 0x38)
            throw new InvalidOperationException("O formato de atributos mudou nesta versão do CS2. Aplicação cancelada.");
        int[] required = [Offsets.dwLocalPlayerPawn, Offsets.dwEntityList, Offsets.m_iHealth,
            Offsets.m_pWeaponServices, Offsets.m_hActiveWeapon, Offsets.m_AttributeManager,
            Offsets.m_Item, Offsets.m_iItemDefinitionIndex, Offsets.m_iItemIDHigh,
            Offsets.m_nFallbackPaintKit, Offsets.m_nFallbackSeed, Offsets.m_flFallbackWear,
            Offsets.m_AttributeList, Offsets.m_Attributes, Offsets.m_hHudModelArms,
            Offsets.m_pGameSceneNode, Offsets.m_modelState, Offsets.m_MeshGroupMask,
            Offsets.m_pChild, Offsets.m_pNextSibling, Offsets.m_pOwner, Offsets.m_hOwnerEntity];
        if (required.Any(value => value <= 0))
            throw new InvalidOperationException("Offsets de materiais indisponíveis. Reinicie o loader após atualizar os dados do CS2.");
    }
}
