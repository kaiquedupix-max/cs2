namespace Mac1ota_Menu.Classes;

internal readonly record struct CosmeticTarget(nint Pawn, byte Team, uint Handle,
    nint Weapon, nint Hud, nint WorldNode, nint HudNode, long Revision);

internal sealed class CosmeticTargetStability
{
    private CosmeticTarget? previous;
    private long since;
    internal void Reset() => previous = null;
    internal bool Ready(CosmeticTarget target, long now)
    {
        if (previous != target) { previous = target; since = now; return false; }
        return now - since >= 500;
    }
}
