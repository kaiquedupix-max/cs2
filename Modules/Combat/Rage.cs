using System.Numerics;
using Mac1ota_Menu.Classes;
using Mac1ota_Menu.Data.Entity;
using Mac1ota_Menu.Data.Game;
using Mac1ota_Menu.Modules.Visual;

namespace Mac1ota_Menu.Modules.Combat;

// Independent target scan/selection/fire pipeline. Axion's internal command and
// penetration systems are not interchangeable with external snapshots/input.
public class Rage : ThreadService, IModule
{
    public static bool Enabled = false;
    public static int ActivationKey = 0x04;
    public static int Priority = 0;
    public static bool KeepTarget = true;
    public static bool OnlyVisible = true;
    public static bool Head = true, Neck = false, Chest = true, Pelvis = true;
    public static int BodyBelowHealth = 25;
    public static float FovDegrees = 30;
    public static float MaxDistanceMeters = 150;
    public static float MaxTurnDegrees = 180;
    public static bool CompensateRecoil = true;
    public static bool AutoFire = false;
    public static bool AutoScope = false;
    public static bool FireOnlyScoped = false;
    public static bool FireOnlyGrounded = true;
    public static bool FireOnlyStill = false;
    public static float MaxFireSpeed = 30;
    public static float ShotToleranceDegrees = .35f;
    public static int ShotIntervalMs = 120;
    public static int TargetDelayMs = 50;
    public override bool IsBackground => true;
    private static volatile string status = "Rage desativado.";
    public static string Status => status;
    private static nint lockedPawn;
    private static long acquiredAt, lastShot, lastScope;

    // Used by the other aim services to avoid competing writes and mouse input.
    public static bool OwnsAim => Enabled && !Renderer.DrawWindow &&
        User32.IsWindowFocused(Renderer.CS2ProcessId) &&
        (ActivationKey == 0 || (User32.GetAsyncKeyState(ActivationKey) & 0x8000) != 0);

    protected override void FrameAction()
    {
        Thread.Sleep(12);
        try { Run(); }
        catch (Exception ex) { status = "Rage: " + ex.Message; ResetTarget(); }
    }

    private static void ResetTarget() { lockedPawn = 0; acquiredAt = 0; }

    private static void Run()
    {
        if (!Enabled) { status = "Rage desativado."; ResetTarget(); return; }
        if (!OwnsAim) { status = Renderer.DrawWindow ? "Feche o menu para usar a mira." : "Aguardando tecla de ativação."; ResetTarget(); return; }
        var mem = GameState.memory;
        var local = GameState.LocalPlayer;
        if (mem == null || local == null || local.Health <= 0 || local.IsBuyMenuOpen || local.IsFlashed ||
            GameState.client == 0 || !GameState.IsConnectedToCS2())
        { status = "Aguardando jogador ativo."; ResetTarget(); return; }
        if (Offsets.dwViewAngles <= 0 || !mem.TryRead(GameState.client + Offsets.dwViewAngles, out Vector3 view) || !RageMath.Finite(view))
        { status = "Ângulos de mira indisponíveis."; return; }
        nint list = GameState.EntityList;
        if (!mem.TryRead(local.PawnAddress + Offsets.m_pWeaponServices, out nint services) || services == 0 ||
            !mem.TryRead(services + Offsets.m_hActiveWeapon, out uint handle)) return;
        nint weapon = EntityManager.GetPlayerPawn(list, (nint)handle);
        if (weapon == 0 || !mem.TryRead(weapon + Offsets.m_AttributeManager + Offsets.m_Item + Offsets.m_iItemDefinitionIndex, out ushort definition)) return;
        bool firearm = definition is 1 or 2 or 3 or 4 or 7 or 8 or 9 or 10 or 11 or 13 or 14 or 16 or 17 or 19 or
            23 or 24 or 25 or 26 or 27 or 28 or 29 or 30 or 32 or 33 or 34 or 35 or 36 or 38 or 39 or 40 or 60 or 61 or 63 or 64;
        if (!firearm) { status = "Equipe uma arma de fogo."; ResetTarget(); return; }
        Vector3 eye = local.EyePosition;
        if (!RageMath.Finite(eye) || eye == Vector3.Zero) return;
        var points = new List<RageMath.Point>();
        var entities = GameState.Entities.ToArray();
        foreach (var e in entities)
        {
            if (e == null || e.PawnAddress == 0 || e.PawnAddress == local.PawnAddress || e.Health <= 0 ||
                e.IsDormant || e.Team == local.Team || e.Bones == null) continue;
            float meters = Vector3.Distance(eye, e.Position) * .0254f;
            if (!float.IsFinite(meters) || meters > Math.Clamp(MaxDistanceMeters, 1, 1000)) continue;
            bool body = BodyBelowHealth > 0 && e.Health <= BodyBelowHealth;
            var regions = new List<(int Index, string Name)>();
            if (Head && !body) regions.Add(((int)BoneESP.BoneIds.Head, "Cabeça"));
            if (Neck && !body) regions.Add(((int)BoneESP.BoneIds.Neck, "Pescoço"));
            if (Chest || body) regions.Add(((int)BoneESP.BoneIds.LowerChest, "Peito"));
            if (Pelvis || body) regions.Add(((int)BoneESP.BoneIds.Pelvis, "Pelve"));
            foreach (var (index, region) in regions)
            {
                if (index < 0 || index >= e.Bones.Count || e.Bones[index] == null) continue;
                Vector3 point = e.Bones[index].Position;
                if (point == Vector3.Zero || !RageMath.Finite(point)) continue;
                // Trace the selected point, rather than trusting an unrelated
                // visible bone on this player. Without map data, do not claim LOS.
                Vector3 angles = RageMath.AimAngles(eye, point);
                float error = RageMath.AngleError(view, angles);
                if (error > Math.Clamp(FovDegrees, 1, 180)) continue;
                if (OnlyVisible && (VisibilityCheck.mapLoaderInstance == null || !VisibilityCheck.Visible(eye, point))) continue;
                points.Add(new(e.PawnAddress, e.Health, point, angles, error, meters, region));
            }
        }
        var selected = RageMath.Select(points, Priority, KeepTarget ? lockedPawn : 0);
        if (selected is not { } target)
        {
            status = OnlyVisible && VisibilityCheck.mapLoaderInstance == null ? "Aguardando dados de visibilidade do mapa." : "Nenhum alvo nos filtros selecionados.";
            ResetTarget(); return;
        }
        long now = Environment.TickCount64;
        if (lockedPawn != target.Pawn) { lockedPawn = target.Pawn; acquiredAt = now; }
        bool sniper = definition is 9 or 11 or 38 or 40;
        if (AutoScope && sniper && !local.IsScoped && now - lastScope > 800)
        {
            User32.mouse_event(0x0008, 0, 0, 0, 0);
            Thread.Sleep(5);
            User32.mouse_event(0x0010, 0, 0, 0, 0);
            lastScope = now;
        }
        Vector3 desired = target.Angles;
        if (CompensateRecoil && local.ShotsFired > 0 && RageMath.Finite(local.AimPunchAngle))
            desired -= new Vector3(local.AimPunchAngle.X, local.AimPunchAngle.Y, 0) * 2f;
        desired = RageMath.Step(view, desired, MaxTurnDegrees);
        if (!mem.TryWrite(GameState.client + Offsets.dwViewAngles, desired))
        { status = "Não foi possível ajustar os ângulos."; return; }
        status = $"Alvo: {target.Region} | {target.Distance:F0} m | {target.Health} HP";
        if (!AutoFire || now - acquiredAt < Math.Clamp(TargetDelayMs, 0, 1000) ||
            now - lastShot < Math.Clamp(ShotIntervalMs, 50, 2000) || (sniper && FireOnlyScoped && !local.IsScoped)) return;
        if (FireOnlyStill && new Vector2(local.Velocity.X, local.Velocity.Y).Length() > Math.Clamp(MaxFireSpeed, 0, 250)) return;
        if (FireOnlyGrounded && (!mem.TryRead(local.PawnAddress + Offsets.m_fFlags, out uint flags) || (flags & 1) == 0)) return;
        if (!VisibilityCheck.Visible(eye, target.Position)) { status = "Disparo bloqueado: ponto sem visibilidade."; return; }
        if (Offsets.m_iClip1 <= 0 || Offsets.m_nNextPrimaryAttackTick <= 0 || Offsets.m_nTickBase <= 0)
        { status = "Disparo bloqueado: dados da arma indisponíveis."; return; }
        if (!mem.TryRead(weapon + Offsets.m_iClip1, out int ammo) || ammo <= 0 ||
            !mem.TryRead(weapon + Offsets.m_nNextPrimaryAttackTick, out int nextAttack) ||
            !mem.TryRead(GameState.client + Offsets.dwLocalPlayerController, out nint controller) || controller == 0 ||
            !mem.TryRead(controller + Offsets.m_nTickBase, out int tick) || tick <= 0 || nextAttack > tick) return;
        if (!mem.TryRead(GameState.client + Offsets.dwViewAngles, out Vector3 actual)) return;
        Vector3 shotAngles = actual;
        if (RageMath.Finite(local.AimPunchAngle)) shotAngles += new Vector3(local.AimPunchAngle.X, local.AimPunchAngle.Y, 0) * 2f;
        if (RageMath.AngleError(shotAngles, target.Angles) > Math.Clamp(ShotToleranceDegrees, .05f, 2f)) return;
        // Require the game's crosshair entity to agree with the scanned target.
        if (!mem.TryRead(local.PawnAddress + Offsets.m_iIDEntIndex, out uint crosshair) ||
            crosshair is 0 or uint.MaxValue ||
            EntityManager.GetPlayerPawn(list, (nint)crosshair) != target.Pawn || !OwnsAim) return;
        User32.Click(); lastShot = now;
        status = "Disparo enviado ao alvo selecionado.";
    }
}
