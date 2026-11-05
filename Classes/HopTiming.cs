namespace Mac1ota_Menu.Classes;

internal sealed class HopTiming
{
    private bool groundedBefore, pressed;
    private long next;
    internal void Reset() { groundedBefore = pressed = false; next = 0; }
    internal bool? Update(bool grounded, long now)
    {
        if (!grounded)
        {
            bool releaseImmediately = pressed;
            groundedBefore = false; pressed = false;
            if (!releaseImmediately && now < next) return null;
            next = now + 4;
            return false;
        }
        if (!groundedBefore)
        { groundedBefore = true; pressed = true; next = now + 20; return true; }
        if (now < next) return null;
        pressed = !pressed;
        next = now + (pressed ? 20 : 4);
        return pressed;
    }
}
