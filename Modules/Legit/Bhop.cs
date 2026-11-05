using Mac1ota_Menu.Classes;
namespace Mac1ota_Menu.Modules.Legit;
public class Bhop : ThreadService, IModule
{
    public static bool BhopEnable = false;
    public static bool AutoStrafe = true;
    protected override void FrameAction() { Thread.Sleep(100); }
}
