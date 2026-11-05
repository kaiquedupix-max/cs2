using Mac1ota_Menu.Data.Game;
using Mac1ota_Menu.Modules.Visual;

namespace Mac1ota_Menu.Classes;

internal static class SkinChangerService
{
    private sealed record Selection(ushort Weapon, int Paint, int Seed, float Wear, bool Legacy, long Revision, string Name, int Rarity, bool StatTrak, int Counter);
    private static readonly object Gate = new();
    private static readonly Dictionary<ushort, Selection> Selections = new();
    private static Task? worker;
    private static Selection? knifeSelection, gloveSelection;
    private static long revision;
    private static int blockedProcess;
    private static volatile string status = "Escolha uma skin e clique em Aplicar.";
    private static volatile string gloveStatus = "Nenhuma luva selecionada nesta sessão.";
    internal static string Status => status;
    internal static string GloveStatus => gloveStatus;
    private static void SetGloveStatus(string message)
    {
        gloveStatus = message;
        try
        {
            string folder = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "legitbaratinho");
            Directory.CreateDirectory(folder);
            File.AppendAllText(Path.Combine(folder, "external-skins.log"), $"{DateTimeOffset.Now:O} Luvas: {message}\n");
        }
        catch { }
    }
    internal static bool Enabled { get => CosmeticLoadout.Automatic; set => CosmeticLoadout.Automatic = value; }
    private static List<CosmeticLoadout.Choice>? synchronizedChoices;
    internal static void Start() { lock (Gate) worker ??= Task.Run(RunAsync); }

    internal static void Select(ushort weapon, int paint, int seed, float wear, bool legacy, string name = "", int rarity = 0, int category = 0,
        bool statTrak = false, int counter = 0)
    {
        if (category == 2) throw new InvalidOperationException("Luvas: Em breve.");
        if (blockedProcess != 0 && blockedProcess == Renderer.CS2ProcessId)
            throw new InvalidOperationException("Reinicie o CS2 após o tempo limite de materiais.");
        _ = SkinMaterialData.Attributes(paint, seed, wear);
        CosmeticLoadout.Set(new(weapon, category, paint, seed, wear, legacy, name, rarity, statTrak, counter));
        Enabled = true;
        status = "Escolha preparada. Será aplicada ao equipar; salve o perfil para reutilizar.";
        if (category == 2) SetGloveStatus("Seleção preparada: " + name + ". Aguardando aplicação.");
        Start();
    }

    private static void Synchronize()
    {
        var choices = CosmeticLoadout.Choices;
        if (ReferenceEquals(choices, synchronizedChoices)) return;
        lock (Gate)
        {
            Selections.Clear(); knifeSelection = gloveSelection = null;
            foreach (var c in (choices ?? new()).Take(128))
            {
                if (c == null || c.Definition == 0 || c.Paint <= 0 || c.Seed is < 0 or > 1000 ||
                    !float.IsFinite(c.Wear) || c.Wear is < 0 or > 1 || c.Counter < 0 || c.Category is < 0 or > 2) continue;
                var selection = new Selection(c.Definition, c.Paint, c.Seed, c.Wear, c.Legacy, ++revision, c.Name, c.Rarity, c.StatTrak, c.Counter);
                if (c.Category == 1) knifeSelection = selection;
                else if (c.Category == 2) continue; // Saved profiles must not activate unfinished gloves.
                else Selections[c.Definition] = selection;
            }
            synchronizedChoices = choices;
        }
    }

    private static async Task RunAsync()
    {
        SkinMaterialSession? session = null;
        int pid = 0;
        nint client = 0;
        (nint Pawn, uint Handle, nint Weapon, long Revision)? lastAttempt = null;
        var appliedWeapons = new HashSet<(nint Pawn, uint Handle, nint Weapon, long Revision)>();
        var hudRefreshed = new HashSet<long>();
        (nint Pawn, long Revision)? lastGloves = null;
        (nint Pawn, long Revision)? failedGloves = null;
        long gloveRetryAt = 0;
        try
        {
            while (true)
            {
                await Task.Delay(Enabled ? 16 : 300);
                Synchronize();
                if (!Enabled || (Selections.Count == 0 && knifeSelection == null && gloveSelection == null))
                { lastAttempt = null; lastGloves = null; failedGloves = null; continue; }
                try
                {
                    int currentPid = Renderer.CS2ProcessId;
                    if (!OffsetGetter.Updated || GameState.EntityList == 0 || GameState.client == 0 || currentPid == 0 || !GameState.IsConnectedToCS2())
                    {
                        session?.Dispose(); session = null;
                        lastAttempt = null;
                        appliedWeapons.Clear(); hudRefreshed.Clear();
                        status = "Aguardando conexão com o CS2...";
                        continue;
                    }
                    if (currentPid == blockedProcess)
                    {
                        status = "Aplicação suspensa neste processo do CS2. Reinicie o jogo para tentar novamente.";
                        await Task.Delay(1000);
                        continue;
                    }
                    if (session == null || currentPid != pid || client != GameState.client)
                    {
                        session?.Dispose(); session = null;
                        pid = currentPid; client = GameState.client;
                        lastAttempt = null;
                        lastGloves = null;
                        failedGloves = null;
                        appliedWeapons.Clear(); hudRefreshed.Clear();
                        ValidateOffsets();
                        session = new(pid, client);
                    }
                    nint pawn = session.Read<nint>(client + Offsets.dwLocalPlayerPawn);
                    if (pawn == 0 || session.Read<int>(pawn + Offsets.m_iHealth) <= 0)
                    { lastGloves = null; failedGloves = null; lastAttempt = null; appliedWeapons.Clear(); continue; }
                    Selection? gloves;
                    lock (Gate) gloves = gloveSelection;
                    if (gloves != null && (failedGloves != (pawn, gloves.Revision) || Environment.TickCount64 >= gloveRetryAt) && (lastGloves != (pawn, gloves.Revision) ||
                        !session.GlovesMatch(pawn, gloves.Weapon, gloves.Paint, gloves.Seed, gloves.Wear)))
                    {
                        try {
                            SetGloveStatus("Tentando aplicar " + gloves.Name + ".");
                            session.ApplyGloves(pawn, gloves.Weapon, gloves.Paint, gloves.Seed, gloves.Wear);
                            lastGloves = (pawn, gloves.Revision);
                            failedGloves = null;
                            SetGloveStatus("Atributos enviados para " + gloves.Name + ". Aparência no jogo ainda não confirmada.");
                        }
                        catch (Exception ex) when (!session.TimedOut) {
                            failedGloves = (pawn, gloves.Revision);
                            gloveRetryAt = Environment.TickCount64 + 5000;
                            SetGloveStatus("Falha: " + ex.Message + " Nova tentativa em 5 segundos.");
                        }
                    }
                    nint services = session.Read<nint>(pawn + Offsets.m_pWeaponServices);
                    if (services == 0) continue;
                    uint handle = session.Read<uint>(services + Offsets.m_hActiveWeapon);
                    nint list = session.Read<nint>(client + Offsets.dwEntityList);
                    nint weapon = session.Entity(list, handle);
                    if (weapon == 0) continue;
                    ushort definition = session.Read<ushort>(weapon + Offsets.m_AttributeManager + Offsets.m_Item + Offsets.m_iItemDefinitionIndex);
                    Selection? selected;
                    lock (Gate)
                    {
                        if (CosmeticModels.IsKnife(definition)) selected = knifeSelection;
                        else Selections.TryGetValue(definition, out selected);
                    }
                    if (selected == null) continue;
                    session.MaintainItemIdentity(weapon);
                    // Keep the name current even when material settings already match.
                    session.SetHudName(weapon, (selected.StatTrak ? "StatTrak™ " : "") + selected.Name, selected.Rarity);
                    if (!session.ModelsReady(pawn, list, weapon)) continue;
                    var attempt = (pawn, handle, weapon, selected.Revision);
                    if (appliedWeapons.Contains(attempt) &&
                        session.MaterialsMatch(pawn, list, weapon, selected.Paint, selected.Seed, selected.Wear, selected.Legacy) &&
                        (!CosmeticModels.IsKnife(definition) || definition == selected.Weapon) &&
                        session.Read<int>(weapon + Offsets.m_nFallbackPaintKit) == selected.Paint &&
                        session.Read<int>(weapon + Offsets.m_nFallbackSeed) == selected.Seed &&
                        System.Math.Abs(session.Read<float>(weapon + Offsets.m_flFallbackWear) - selected.Wear) < .001f) continue;
                    status = "Reconstruindo os materiais da arma...";
                    if (CosmeticModels.IsKnife(definition))
                    {
                        session.ChangeKnife(pawn, list, handle, selected.Weapon);
                        definition = selected.Weapon;
                    }
                    session.SetStatTrak(weapon, selected.StatTrak, selected.Counter, CosmeticModels.IsKnife(definition));

                    int materials = session.Apply(pawn, list, handle, definition, selected.Paint, selected.Seed, selected.Wear, selected.Legacy);
                    lastAttempt = attempt;
                    if (appliedWeapons.Count >= 128) appliedWeapons.Clear();
                    appliedWeapons.Add(attempt);
                    session.SetHudName(weapon, (selected.StatTrak ? "StatTrak™ " : "") + selected.Name, selected.Rarity, invalidate: true);
                    if (!hudRefreshed.Contains(selected.Revision) && session.RequestHudRefresh())
                        hudRefreshed.Add(selected.Revision);
                    status = $"O jogo gerou {materials} material(is) para o paint kit #{selected.Paint}. Textura visual ainda não confirmada.";
                }
                catch (System.ComponentModel.Win32Exception ex) when (session?.TimedOut != true)
                {
                    status = "Aguardando a entidade da arma: " + ex.Message;
                    await Task.Delay(1000);
                }
                catch (Exception ex)
                {
                    // A runtime failure must not clear the user's automatic-apply preference.
                    // Timeouts can indicate that the game's material routine is no longer safe
                    // to call in this process, so suspend retries until CS2 is restarted.
                    if (session?.TimedOut == true)
                    {
                        blockedProcess = pid;
                        session.Dispose();
                        session = null;
                        status = "Aplicação suspensa após tempo limite. Reinicie o CS2: " + ex.Message;
                    }
                    else
                    {
                        status = "Falha ao aplicar skin; nova tentativa em 1 segundo: " + ex.Message;
                        await Task.Delay(1000);
                    }
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
