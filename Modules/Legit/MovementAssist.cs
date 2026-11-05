// C# / MovementAssist.cs / .NET 10 / CS2 Windows x64
using System.Numerics;
using Mac1ota_Menu.Classes;
using Mac1ota_Menu.Data.Game;

namespace Mac1ota_Menu.Modules.Legit;

public sealed class MovementAssist : ThreadService, IModule
{
    public static bool Enabled = false;
    public static bool AutoStrafe = true;
    public static bool StraightForward = true;
    private static string status = "Desativado.";
    internal static string Status => Volatile.Read(ref status);
    public override bool IsBackground => true;
    private bool controlling, wasGrounded;
    private nint controlledClient;
    private int controlledPid;
    private nint controlledPawn;
    private int side = 1;
    private float? previousYaw;
    private long nextSteer;
    private readonly HopTiming hop = new();
    private readonly HashSet<int> ownedButtons = new();

    protected override void FrameAction()
    {
        try { Update(); }
        catch (Exception ex) { Release(); status = "Movimento pausado: " + ex.Message; }
    }

    private void Update()
    {
        var memory = GameState.memory;
        if (!Enabled || memory == null || !OffsetGetter.Updated || GameState.client == 0 ||
            Renderer.DrawWindow || !User32.IsWindowFocused(Renderer.CS2ProcessId) ||
            (User32.GetAsyncKeyState(0x20) & 0x8000) == 0)
        {
            Release();
            status = Enabled ? "Segure Espaço com o menu fechado." : "Desativado.";
            return;
        }
        if (Offsets.jump <= 0 || Offsets.m_MoveType <= 0 || (StraightForward && Offsets.forward <= 0) ||
            (!StraightForward && AutoStrafe && (Offsets.left <= 0 || Offsets.right <= 0 || Offsets.dwViewAngles <= 0)))
        { Release(); status = "Dados de movimento indisponíveis nesta versão."; return; }
        if (!memory.TryRead<nint>(GameState.client + Offsets.dwLocalPlayerPawn, out var pawn) || pawn == 0 ||
            !memory.TryRead<int>(pawn + Offsets.m_iHealth, out var health) || health <= 0 ||
            !memory.TryRead<uint>(pawn + Offsets.m_fFlags, out var flags) ||
            !memory.TryRead<byte>(pawn + Offsets.m_MoveType, out var moveType) || moveType != 2 ||
            !memory.TryRead<byte>(pawn + Offsets.m_bIsBuyMenuOpen, out var buying) || buying != 0)
        { Release(); status = "Aguardando jogador vivo em movimento normal."; return; }
        if (controlling && (controlledClient != GameState.client || controlledPid != Renderer.CS2ProcessId || controlledPawn != pawn)) Release();
        controlledClient = GameState.client; controlledPid = Renderer.CS2ProcessId; controlling = true;
        controlledPawn = pawn;
        bool grounded = (flags & 1) != 0;
        // Release in flight so each landing produces a new press edge.
        long now = Environment.TickCount64;
        if (hop.Update(grounded, now) is bool press) Button(Offsets.jump, press);
        if (grounded && !wasGrounded) side = -side;
        wasGrounded = grounded;
        if (StraightForward)
        {
            ReleaseStrafe(); previousYaw = null; nextSteer = 0;
            if ((User32.GetAsyncKeyState(0x53) & 0x8000) == 0) Button(Offsets.forward, true);
            else RestoreButton(Offsets.forward);
            status = "Bhop para frente ativo. A câmera permanece sob seu controle.";
            return;
        }
        RestoreButton(Offsets.forward);
        status = "Bunny hop ativo" + (AutoStrafe ? " + auto strafe." : ".");
        bool manualSteering = (User32.GetAsyncKeyState(0x41) & 0x8000) != 0 || (User32.GetAsyncKeyState(0x44) & 0x8000) != 0;
        if (!AutoStrafe || grounded || manualSteering || (User32.GetAsyncKeyState(1) & 0x8000) != 0)
        { ReleaseStrafe(); previousYaw = null; return; }
        if (Environment.TickCount64 < nextSteer) return;
        float steerSeconds = nextSteer == 0 ? .008f : Math.Clamp((now - nextSteer + 8) / 1000f, .001f, .025f);
        nextSteer = now + 8;
        if (!memory.TryRead<Vector3>(pawn + Offsets.m_vecAbsVelocity, out var velocity) ||
            !memory.TryRead<Vector3>(controlledClient + Offsets.dwViewAngles, out var angles) ||
            !float.IsFinite(velocity.X) || !float.IsFinite(velocity.Y) || !float.IsFinite(angles.Y))
        { ReleaseStrafe(); return; }
        float speed = new Vector2(velocity.X, velocity.Y).Length();
        if (speed < 30f)
        { Button(Offsets.left, side < 0); Button(Offsets.right, side > 0); return; }
        float delta = previousYaw.HasValue ? MovementMath.Normalize(angles.Y - previousYaw.Value) : 0;
        if (MathF.Abs(delta) > .15f) side = delta > 0 ? 1 : -1;
        float desired = MovementMath.StrafeYaw(velocity.X, velocity.Y, side);
        float maxTurn = 90f * steerSeconds;
        float turn = Math.Clamp(MovementMath.Normalize(desired - angles.Y), -maxTurn, maxTurn);
        float yaw = MovementMath.Normalize(angles.Y + turn);
        Button(Offsets.left, side < 0);
        Button(Offsets.right, side > 0);
        if (!memory.TryWrite(controlledClient + Offsets.dwViewAngles + sizeof(float), yaw))
            throw new InvalidOperationException("Falha ao atualizar direção.");
        previousYaw = yaw;
    }

    private void Button(int offset, bool down)
    {
        if (offset <= 0) return;
        if (!GameState.memory!.TryWrite(controlledClient + offset, down ? 65537 : 256))
            throw new InvalidOperationException("Falha ao atualizar entrada de movimento.");
        ownedButtons.Add(offset);
    }

    private void ReleaseStrafe()
    {
        foreach (int offset in new[] { Offsets.left, Offsets.right })
            RestoreButton(offset);
    }

    private void RestoreButton(int offset)
    {
        if (!ownedButtons.Contains(offset)) return;
        int key = offset == Offsets.left ? 0x41 : offset == Offsets.right ? 0x44 : offset == Offsets.forward ? 0x57 : 0x20;
        int state = User32.IsWindowFocused(controlledPid) && (User32.GetAsyncKeyState(key) & 0x8000) != 0 ? 65537 : 256;
        if (GameState.memory?.TryWrite(controlledClient + offset, state) == true) ownedButtons.Remove(offset);
    }

    private void Release()
    {
        if (controlling && controlledPid == Renderer.CS2ProcessId && controlledClient == GameState.client)
            foreach (int offset in ownedButtons.ToArray()) RestoreButton(offset);
        ownedButtons.Clear(); controlling = false; wasGrounded = false; previousYaw = null; nextSteer = 0;
        controlledPawn = 0; hop.Reset();
    }
}
