using K4os.Compression.LZ4.Internal;
using System;
using System.Collections.Generic;
using System.Text;
using Mac1ota_Menu.Classes;
using Mac1ota_Menu.Classes.Memory;
using Mac1ota_Menu.Data.Game;

namespace Mac1ota_Menu.Modules.Visual
{
    internal class NoScope : ThreadService
    {
        protected override void FrameAction()
        {
            if (GameState.memory == null || GameState.LocalPlayer == null
                || GameState.LocalPlayer.PawnAddress == IntPtr.Zero)
                return;

        }
    }
}
