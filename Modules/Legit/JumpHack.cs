using Mac1ota_Menu.Classes;
using Mac1ota_Menu.Data.Game;

namespace Mac1ota_Menu.Modules.Legit
{
    internal class JumpHack : IModule
    {
        public static bool JumpHackEnabled = false;
        public static int JumpHotkey = 0x20;
        public static void JumpShot()
        {
            if (!JumpHackEnabled || GameState.LocalPlayer == null || GameState.LocalPlayer.Health == 0 || GameState.Entities.Count == 0) return;

            if (User32.GetAsyncKeyState(JumpHotkey) < 0 && GameState.LocalPlayer.Velocity.Z > 287)
            {
                User32.Click();
            }
        }
        //protected override void FrameAction()
        //{
        //    JumpShot();
        //}
    }
}
