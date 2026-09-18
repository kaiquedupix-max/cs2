using System.Diagnostics;
using System.Runtime.InteropServices;

namespace Mac1ota_Menu.Classes
{
    [ComImport]
    [Guid("56FDF342-FD6D-11D0-958A-006097C9A090")]
    [InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    internal interface ITaskbarList
    {
        void HrInit();
        void AddTab(IntPtr hwnd);
        void DeleteTab(IntPtr hwnd);
        void ActivateTab(IntPtr hwnd);
        void SetActiveAlt(IntPtr hwnd);
    }

    internal static class TaskbarWindowHelper
    {
        private static readonly Guid TaskbarListClsid =
            new("56FDF344-FD6D-11D0-958A-006097C9A090");

        public static bool TryRemoveTaskbarButton(
            IntPtr hwnd)
        {
            if (hwnd == IntPtr.Zero)
            {
                return false;
            }

            object? instance =
                null;

            try
            {
                Type? type =
                    Type.GetTypeFromCLSID(
                        TaskbarListClsid);

                if (type == null)
                {
                    return false;
                }

                instance =
                    Activator.CreateInstance(
                        type);

                if (instance is not ITaskbarList taskbar)
                {
                    return false;
                }

                taskbar.HrInit();
                taskbar.DeleteTab(
                    hwnd);

                return true;
            }
            catch
            {
                return false;
            }
            finally
            {
                if (instance != null &&
                    Marshal.IsComObject(
                        instance))
                {
                    Marshal.FinalReleaseComObject(
                        instance);
                }
            }
        }
    }

    internal class User32 // what is SYSLIB1054 pls help
    {
        private static HashSet<int> _heldKeys = new();

        [StructLayout(LayoutKind.Sequential)]
        public struct INPUT
        {
            public uint type;
            public InputUnion U;
        }
        [StructLayout(LayoutKind.Explicit)]
        public struct InputUnion
        {
            [FieldOffset(0)] public MOUSEINPUT mi;
            [FieldOffset(0)] public KEYBDINPUT ki;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct POINT
        {
            public int X;
            public int Y;
        }
        [StructLayout(LayoutKind.Sequential)]
        public struct MOUSEINPUT
        {
            public int dx;
            public int dy;
            public int mouseData;
            public uint dwFlags;
            public uint time;
            public IntPtr dwExtraInfo;
        }
        [StructLayout(LayoutKind.Sequential)]
        public struct KEYBDINPUT
        {
            public ushort wVk;
            public ushort wScan;
            public uint dwFlags;
            public uint time;
            public IntPtr dwExtraInfo;
        }

        [StructLayout(LayoutKind.Sequential)]
        public struct RECT
        {
            public int Left;        // x position of upper-left corner
            public int Top;         // y position of upper-left corner
            public int Right;       // x position of lower-right corner
            public int Bottom;      // y position of lower-right corner
        }

        public const int INPUT_KEYBOARD = 1;
        public const int INPUT_MOUSE = 0;

        public const uint WDA_NONE = 0x00000000;
        public const uint WDA_MONITOR = 0x00000001;
        public const uint WDA_EXCLUDEFROMCAPTURE = 0x00000011;
        public const uint MOUSEEVENTF_MOVE = 0x0001;
        public const uint MOUSEEVENTF_LEFTDOWN = 0x0002;
        public const uint MOUSEEVENTF_LEFTUP = 0x0004;
        public const uint KEYEVENTF_KEYDOWN = 0x0000;
        public const uint KEYEVENTF_SCANCODE = 0x0008;
        public const uint KEYEVENTF_KEYUP = 0x0002;
        public const byte VK_SPACE = 0x20;
        private const int WH_KEYBOARD_LL = 13;
        private const int WM_KEYDOWN = 0x0100;
        private static IntPtr _hookID = IntPtr.Zero;
        private delegate IntPtr LowLevelKeyboardProc(int nCode, IntPtr wParam, IntPtr lParam);
        [DllImport("user32.dll", SetLastError = true)]
        public static extern bool ClientToScreen(IntPtr hWnd, out System.Drawing.Point lpPoint);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern IntPtr GetForegroundWindow();

        [DllImport("user32.dll", SetLastError = true)]
        public static extern IntPtr FindWindow(string lpClassName, string lpWindowName);

        [DllImport("user32.dll", SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        public static extern bool SetWindowDisplayAffinity(
            IntPtr hWnd,
            uint dwAffinity);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern bool UnhookWindowsHookEx(IntPtr hInstance);
        [DllImport("user32.dll")]
        private static extern IntPtr SetWindowsHookEx(int idHook, LowLevelKeyboardProc lpfn, IntPtr hMod, uint dwThreadId);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern short GetAsyncKeyState(int vKey);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern IntPtr CallNextHookEx(IntPtr idHook, int nCode, IntPtr wParam, IntPtr lParam);

        [DllImport("user32.dll")]
        public static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, int dwExtraInfo);
        [DllImport("user32.dll")]
        public static extern void keybd_event(byte bVk, byte bScan, uint dwFlags, int dwExtraInfo);
        [DllImport("user32.dll", SetLastError = true)]
        public static extern uint SendInput(uint nInputs, [In] INPUT[] pInputs, int cbSize);

        [DllImport("user32.dll")]
        public static extern bool GetCursorPos(out POINT lpPoint);

        [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
        private static extern IntPtr GetModuleHandle(string lpModuleName);
        [DllImport("user32.dll")]
        static extern uint GetWindowThreadProcessId(IntPtr hWnd, out uint processId);

        [DllImport("user32.dll")]
        public static extern bool GetWindowRect(IntPtr hWnd, ref RECT lpRect);

        [DllImport("user32.dll", SetLastError = true)]
        public static extern bool GetClientRect(IntPtr hWnd, ref RECT lpRect);
        public static bool GetKeyHeld(Keys key)
        {
            return ((ushort)GetAsyncKeyState((int)key) & 0x8000) != 0;
        }
        public static bool GetKeyHeld(int key)
        {
            return ((ushort)GetAsyncKeyState(key) & 0x8000) != 0;
        }

        public static bool GetKeyPressed(int key)
        {
            bool held = ((ushort)GetAsyncKeyState(key) & 0x8000) != 0;
            if (held && _heldKeys.Add(key)) return true;
            if (!held) _heldKeys.Remove(key);
            return false;
        }

        public static bool IsWindowFocused(int processId)
        {
            IntPtr hwnd = GetForegroundWindow();
            GetWindowThreadProcessId(hwnd, out uint focusedPid);
            return focusedPid == (uint)processId;
        }
        public static void Click()
        {
            mouse_event(MOUSEEVENTF_LEFTDOWN, 0, 0, 0, 0);
            Thread.Sleep(5);
            mouse_event(MOUSEEVENTF_LEFTUP, 0, 0, 0, 0);
        }

        public static void Jump(bool on)
        {
            INPUT[] Inputs = new INPUT[1];
            Inputs[0].type = INPUT_KEYBOARD;
            Inputs[0].U.ki = new KEYBDINPUT
            {
                wVk = VK_SPACE,
                wScan = 0,
                dwFlags = on ? KEYEVENTF_KEYDOWN : KEYEVENTF_KEYUP,
                time = 0,
                dwExtraInfo = IntPtr.Zero
            };

            SendInput((uint)Inputs.Length, Inputs, Marshal.SizeOf(typeof(INPUT)));
        }

        public static void MouseMove(int dx, int dy)
        {
            var inputs = new INPUT[1];
            inputs[0].type = INPUT_MOUSE;
            inputs[0].U.mi = new MOUSEINPUT
            {
                dx = dx,
                dy = dy,
                dwFlags = MOUSEEVENTF_MOVE
            };
            SendInput(1, inputs, Marshal.SizeOf(typeof(INPUT)));
        }
    }
}
