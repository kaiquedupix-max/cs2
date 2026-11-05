using System.Diagnostics;
using System.IO.MemoryMappedFiles;
using System.Numerics;
using System.Reflection;
using System.Security.Cryptography;
using System.Text;
using Mac1ota_Menu.Classes;
using Mac1ota_Menu.Data.Game;
using Mac1ota_Menu.Modules.Combat;
using Mac1ota_Menu.Modules.Legit;
namespace Mac1ota_Menu.Modules.Visual;
public class NativeBridge : ThreadService, IModule
{
    public static bool UseNativeCosmetics = true;
    public static bool Spinbot = false, ThirdPerson = false, ChatSpam = false;
    public static float SpinSpeed = 720, ThirdDistance = 120;
    public override bool IsBackground => true;
    private static volatile string status = "Módulo nativo aguardando o CS2.";
    private static volatile uint inputState;
    public static string Status => status;
    public static bool InputAvailable => (inputState & 3) == 3 && (inputState & 0x80000000) == 0;
    public static string InputStatus => (inputState & 0x80000000) != 0 ? "Comandos nativos interrompidos após incompatibilidade. Reinicie o jogo." :
        (inputState & 1) == 0 ? "Hook de comandos ainda indisponível. " + Status :
        (inputState & 2) == 0 ? "Hook conectado. Aguardando um comando válido na partida." :
        "Comandos nativos ativos." + ((inputState & 4) == 0 && ThirdPerson ? " Câmera indisponível nesta versão." : "");
    private sealed record Aim(Vector3 Angles, long Expires, long FireUntil);
    private static Aim? aim;
    internal static void ClearAim() => Volatile.Write(ref aim, null);
    internal static void PublishAim(Vector3 angles, bool fire = false)
    {
        long now = Environment.TickCount64;
        var previous = Volatile.Read(ref aim);
        Volatile.Write(ref aim, new(angles, now + 120, fire ? now + 50 : previous?.FireUntil ?? 0));
    }
    private MemoryMappedFile? mapping;
    private MemoryMappedViewAccessor? view;
    private SkinMaterialSession? session;
    private int pid, blocked;
    private uint generation;
    private uint aimGeneration;
    private long lastConfig, lastStatus;
    private byte[]? previousConfig;
    private static string ExtractLibrary()
    {
        using var resource = Assembly.GetExecutingAssembly().GetManifestResourceStream("legit_native.dll")
            ?? throw new InvalidOperationException("Esta compilação não contém o módulo C++.");
        using var bytes = new MemoryStream(); resource.CopyTo(bytes);
        byte[] binary = bytes.ToArray(); string digest = Convert.ToHexString(SHA256.HashData(binary));
        string directory = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "legitbaratinho", "native", digest);
        Directory.CreateDirectory(directory); string path = Path.Combine(directory, "legit_native.dll");
        if (!File.Exists(path) || !SHA256.HashData(File.ReadAllBytes(path)).SequenceEqual(SHA256.HashData(binary))) File.WriteAllBytes(path, binary);
        using var notices = Assembly.GetExecutingAssembly().GetManifestResourceStream("native_notices.txt");
        if (notices != null) { using var output = File.Create(Path.Combine(directory, "THIRD-PARTY-NOTICES.txt")); notices.CopyTo(output); }
        return path;
    }
    private void Disconnect()
    {
        view?.Dispose(); view = null; mapping?.Dispose(); mapping = null; session?.Dispose(); session = null;
        previousConfig = null; inputState = 0; generation = 0; pid = 0;
    }
    private byte[] BuildConfig()
    {
        var choices = UseNativeCosmetics ? (CosmeticLoadout.Choices ?? new()) : new();
        return NativeBridgeData.Config(choices, new(CosmeticLoadout.Automatic && UseNativeCosmetics, Spinbot, Rage.Enabled && Rage.Silent, Rage.NoSpreadLocal,
            Bhop.BhopEnable, Bhop.AutoStrafe, ThirdPerson, ChatSpam, SpinSpeed, ThirdDistance,
            Offsets.dwCSGOInput, Offsets.dwLocalPlayerController, Offsets.dwLocalPlayerPawn, Offsets.m_iHealth, Offsets.m_fFlags, Offsets.m_MoveType, Offsets.m_vecAbsVelocity));
    }
    private void WriteConfig()
    {
        byte[] data = BuildConfig();
        if (previousConfig != null && data.SequenceEqual(previousConfig)) return;
        previousConfig = data.ToArray(); generation += 2;
        BitConverter.GetBytes(generation | 1).CopyTo(data, 12);
        view!.Write(12, generation | 1); view.WriteArray(0, data, 0, data.Length);
        Thread.MemoryBarrier(); view.Write(12, generation);
    }
    protected override void FrameAction()
    {
        Thread.Sleep(5);
        try
        {
            int current = Renderer.CS2ProcessId;
            if (!OffsetGetter.Updated || GameState.client == 0 || current == 0 || !GameState.IsConnectedToCS2())
            { if (view != null) Disconnect(); return; }
            if (pid != 0 && current != pid) Disconnect();
            if (blocked == current) return;
            bool wanted = (UseNativeCosmetics && (CosmeticLoadout.Choices?.Count ?? 0) > 0) || Spinbot || (Rage.Enabled && (Rage.Silent || Rage.AutoStop)) || Rage.NoSpreadLocal || Bhop.BhopEnable || ThirdPerson || ChatSpam;
            if (!wanted && view == null) return;
            if (view == null)
            {
                string path = ExtractLibrary();
                using var process = Process.GetProcessById(current);
                var loaded = process.Modules.Cast<ProcessModule>().FirstOrDefault(m => m.ModuleName.Equals("legit_native.dll", StringComparison.OrdinalIgnoreCase));
                if (loaded != null && !Path.GetFullPath(loaded.FileName).Equals(path, StringComparison.OrdinalIgnoreCase))
                    throw new InvalidOperationException("Reinicie o CS2 para carregar esta versão do módulo C++.");
                pid = current; mapping = MemoryMappedFile.CreateOrOpen("Local\\LegitBridge_" + pid, NativeBridgeData.SharedSize);
                view = mapping.CreateViewAccessor();
                generation = view.ReadUInt32(2136) & ~1u;
                WriteConfig();
                view.Write(2176, (ulong)Environment.TickCount64);
                session = new(pid, GameState.client);
                if (loaded == null) session.LoadBridge(path);
                status = "Módulo C++ carregado; aguardando inicialização na thread do jogo.";
            }
            long now = Environment.TickCount64;
            if (now - lastConfig >= 100) { WriteConfig(); lastConfig = now; }
            view.Write(2148, Renderer.DrawWindow ? 1u : 0u);
            view.Write(2152, User32.IsWindowFocused(current) ? 1u : 0u);
            view.Write(2176, (ulong)now);
            var packet = Volatile.Read(ref aim);
            view.Write(2140, ++aimGeneration);
            view.Write(2156, 0u);
            if (Rage.Enabled && packet != null && packet.Expires >= now)
            {
                view.Write(2160, packet.Angles.X); view.Write(2164, packet.Angles.Y); view.Write(2168, (ulong)packet.Expires);
                Thread.MemoryBarrier(); view.Write(2156, 1u | (packet.FireUntil >= now ? 2u : 0u) | (Rage.AutoStop ? 4u : 0u));
            }
            Thread.MemoryBarrier(); view.Write(2140, ++aimGeneration);
            if (now - lastStatus >= 200)
            {
                inputState = view.ReadUInt32(2144);
                byte[] message = new byte[512]; view.ReadArray(NativeBridgeData.MessageOffset, message, 0, message.Length);
                int end = Array.IndexOf(message, (byte)0);
                if (end > 0) status = Encoding.UTF8.GetString(message, 0, end);
                lastStatus = now;
            }
        }
        catch (Exception ex) { status = ex.Message; blocked = Renderer.CS2ProcessId; Disconnect(); Thread.Sleep(300); }
    }
}
