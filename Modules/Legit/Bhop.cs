using Mac1ota_Menu.Classes;
using Mac1ota_Menu.Data.Game;
namespace Mac1ota_Menu.Modules.Legit;
public class Bhop : ThreadService, IModule
{
    public static bool BhopEnable = false;
    private bool pressed;
    private nint lastAddress;
    protected override void FrameAction()
    {
        Thread.Sleep(3);
        var mem = GameState.memory;
        if (mem == null) return;
        bool active = BhopEnable && !Renderer.DrawWindow && OffsetGetter.Updated &&
            Offsets.jump > 0 && GameState.client != 0 &&
            User32.IsWindowFocused(Renderer.CS2ProcessId) &&
            (User32.GetAsyncKeyState(0x20) & 0x8000) != 0 &&
            GameState.LocalPlayer is { Health: > 0, IsBuyMenuOpen: false };
        nint address = GameState.client + Offsets.jump;
        if (!active)
        {
            if (pressed && address == lastAddress) mem.TryWrite(address, 256);
            pressed = false;
            return;
        }
        if (!mem.TryRead(GameState.LocalPlayer!.PawnAddress + Offsets.m_fFlags, out uint flags)) return;
        bool next = (flags & 1) != 0 && !pressed;
        if (mem.TryWrite(address, next ? 65537 : 256)) { pressed = next; lastAddress = address; }
    }
}
