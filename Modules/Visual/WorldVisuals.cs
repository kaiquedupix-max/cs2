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
    private int previousProcess;
    private nint previousList;
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
        try { UpdateSky(); }
        catch (Exception ex) { status = "Céu: " + ex.Message; }
    }

    private static nint EntityAt(nint list, int index)
    {
        var mem = GameState.memory;
        if (mem == null || !mem.TryRead(list + 0x10 + 8 * (index >> 9), out nint page) || page == 0 ||
            !mem.TryRead(page + 0x70 * (index & 511), out nint entity)) return 0;
        return entity;
    }

    private void UpdateSky()
    {
        var mem = GameState.memory;
        if (mem == null || !GameState.IsConnectedToCS2())
        { originals.Clear(); previousList = 0; lastScan = 0; status = "Aguardando conexão com o jogo."; return; }
        if (Offsets.m_SkyTint <= 0 || Offsets.m_SkyBrightness <= 0 || Offsets.m_SkyDesignerName <= 0 || Offsets.m_pEntity <= 0)
        { status = "Dados do céu indisponíveis nesta versão."; return; }
        if (!BlackSky && originals.Count == 0) return;
        string map = GlobalVar.GetCurrentMapName();
        if (map != previousMap) { originals.Clear(); previousMap = map; lastScan = 0; }
        nint list = GameState.EntityList;
        if (list == 0) return;
        if (previousProcess != Renderer.CS2ProcessId || previousList != list)
        { originals.Clear(); lastScan = 0; previousProcess = Renderer.CS2ProcessId; previousList = list; }
        if (BlackSky && (lastScan == 0 || Environment.TickCount64 - lastScan > 2000))
        {
            lastScan = Environment.TickCount64;
            // Client-only sky entities occupy indices above 16384; the server's
            // highest entity index and the old 8192 cap exclude them.
            for (int i = 1; i < 32768; i++)
            {
                if (!mem.TryRead(list + 0x10 + 8 * (i >> 9), out nint page) || page == 0)
                { i |= 511; continue; }
                if (originals.ContainsKey(i)) continue;
                nint entity = EntityAt(list, i);
                if (!IsSky(entity, out nint identity) || !mem.TryRead(entity + Offsets.m_SkyTint, out uint tint) ||
                    !mem.TryRead(entity + Offsets.m_SkyBrightness, out float brightness) || !float.IsFinite(brightness)) continue;
                originals[i] = new(entity, identity, tint, brightness);
            }
        }
        bool failed = false;
        foreach (var (index, original) in originals.ToArray())
        {
            nint entity = EntityAt(list, index);
            if (entity != original.Entity || !IsSky(entity, out nint identity) || identity != original.Identity)
            { originals.Remove(index); continue; }
            uint tint = BlackSky ? 0xFF000000u : original.Tint;
            float brightness = BlackSky ? 0f : original.Brightness;
            bool tintWritten = mem.TryWrite(entity + Offsets.m_SkyTint, tint);
            bool brightnessWritten = mem.TryWrite(entity + Offsets.m_SkyBrightness, brightness);
            failed |= !tintWritten || !brightnessWritten ||
                !mem.TryRead(entity + Offsets.m_SkyTint, out uint actualTint) || actualTint != tint ||
                !mem.TryRead(entity + Offsets.m_SkyBrightness, out float actualBrightness) || actualBrightness != brightness;
        }
        if (failed) { status = "Não foi possível atualizar o céu."; return; }
        if (!BlackSky) { originals.Clear(); status = "Céu original restaurado."; }
        else status = originals.Count > 0 ? $"Cor preta aplicada a {originals.Count} entidade(s) de céu." : "Nenhuma entidade env_sky encontrada no mapa atual.";
    }
}
