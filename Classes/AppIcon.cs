using System.Drawing;

namespace Mac1ota_Menu.Classes
{
    // The application icon (the exe's own icon, MenuLogo.ico) for every window. A WinForms Form without an Icon shows the
    // generic blank window icon on the taskbar.
    internal static class AppIcon
    {
        private static Icon? _icon;
        private static bool _loaded;

        public static Icon? Get()
        {
            if (!_loaded)
            {
                _loaded = true;
                try
                {
                    string? path = Environment.ProcessPath;
                    if (!string.IsNullOrEmpty(path))
                    {
                        _icon = Icon.ExtractAssociatedIcon(path);
                    }
                }
                catch
                {
                    _icon = null;
                }
            }

            return _icon;
        }
    }
}
