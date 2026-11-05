using Mac1ota_Menu.Classes;
using Mac1ota_Menu.Data.Entity;
using Mac1ota_Menu.Data.Game;

namespace Mac1ota_Menu.Modules.Visual;

public class WorldVisuals : ThreadService, IModule
{
    public static bool BlackSky = false;
    public override bool IsBackground => true;
    private sealed record Sky(nint Entity, nint Identity, uint Tint, float Brightness);
    private readonly Dictionary<int, Sky> originals = new();
    private long lastScan;
    private string previousMap = "";
    private static volatile string status = "Céu original.";
    public static string Status => status;

    private static bool IsSky(nint entity, out nint identity)
    {
        identity = 0; var mem = GameState.memory;
        if (mem == null || entity == 0 || !mem.TryRead(entity + Offsets.m_pEntity, out identity) || identity == 0 ||
            !mem.TryRead(identity + Offsets.m_SkyDesignerName, out nint name) || name == 0) return false;
        return mem.ReadString(name, 32) == "env_sky";
    }

    protected override void FrameAction()
    {
        Thread.Sleep(200);
        var mem = GameState.memory;
        if (mem == null || !GameState.IsConnectedToCS2() || Offsets.m_SkyTint <= 0 ||
            Offsets.m_SkyBrightness <= 0 || Offsets.m_SkyDesignerName <= 0) return;
        if (!BlackSky && originals.Count == 0) return;
        string map = GlobalVar.GetCurrentMapName();
        if (map != previousMap) { originals.Clear(); previousMap = map; lastScan = 0; }
        nint list = GameState.EntityList;
        if (list == 0) return;
        if (BlackSky && Environment.TickCount64 - lastScan > 2000)
        {
            lastScan = Environment.TickCount64;
            int highest = 4096;
            if (Offsets.dwGameEntitySystem_highestEntityIndex > 0 &&
                mem.TryRead(list + Offsets.dwGameEntitySystem_highestEntityIndex, out int value) && value is >= 64 and < 32768)
                highest = Math.Min(value, 8192);
            for (int i = 64; i <= highest; i++)
            {
                if (originals.ContainsKey(i)) continue;
                nint entity = EntityManager.GetPlayerPawn(list, (nint)i);
                if (!IsSky(entity, out nint identity) || !mem.TryRead(entity + Offsets.m_SkyTint, out uint tint) ||
                    !mem.TryRead(entity + Offsets.m_SkyBrightness, out float brightness) || !float.IsFinite(brightness)) continue;
                originals[i] = new(entity, identity, tint, brightness);
            }
        }
        bool failed = false;
        foreach (var (index, original) in originals.ToArray())
        {
            nint entity = EntityManager.GetPlayerPawn(list, (nint)index);
            if (entity != original.Entity || !IsSky(entity, out nint identity) || identity != original.Identity)
            { originals.Remove(index); continue; }
            failed |= !mem.TryWrite(entity + Offsets.m_SkyTint, BlackSky ? 0xFF000000u : original.Tint) ||
                !mem.TryWrite(entity + Offsets.m_SkyBrightness, BlackSky ? 0f : original.Brightness);
        }
        if (failed) { status = "Não foi possível atualizar o céu."; return; }
        if (!BlackSky) { originals.Clear(); status = "Céu original restaurado."; }
        else status = originals.Count > 0 ? "Céu preto ativado." : "Aguardando entidade de céu do mapa.";
    }
}
