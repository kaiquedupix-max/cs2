using System.Diagnostics;
using System.Runtime.InteropServices;

namespace Mac1ota_Menu.Classes;

internal static class ManualChat
{
    internal const string Message = "1 dia gratis legitbaratinho.xyz";
    private static int busy;
    private static string status = "Um envio por clique. Usa o atalho padrão Y do chat.";
    internal static bool Busy => Volatile.Read(ref busy) != 0;
    internal static string Status => Volatile.Read(ref status);
    [DllImport("user32.dll")] private static extern bool SetForegroundWindow(nint window);

    internal static void SendOnce()
    {
        if (Interlocked.CompareExchange(ref busy, 1, 0) != 0) return;
        _ = Task.Run(async () =>
        {
            try
            {
                int pid = Renderer.CS2ProcessId;
                if (pid == 0) throw new InvalidOperationException("Abra o CS2 antes de enviar.");
                using var game = Process.GetProcessById(pid);
                if (game.HasExited || !game.ProcessName.Equals("cs2", StringComparison.OrdinalIgnoreCase))
                    throw new InvalidOperationException("CS2 indisponível.");
                Renderer.DrawWindow = false;
                await Task.Delay(200);
                SetForegroundWindow(game.MainWindowHandle);
                await Task.Delay(200);
                void CheckFocus()
                {
                    if (!User32.IsWindowFocused(pid)) throw new InvalidOperationException("Envio cancelado: CS2 fora de foco.");
                    foreach (int key in new[] { 0x10, 0x11, 0x12 })
                        if ((User32.GetAsyncKeyState(key) & 0x8000) != 0)
                            throw new InvalidOperationException("Solte Shift, Ctrl e Alt antes de enviar.");
                }
                void Send(User32.INPUT[] inputs)
                {
                    CheckFocus();
                    if (User32.SendInput((uint)inputs.Length, inputs, Marshal.SizeOf<User32.INPUT>()) != inputs.Length)
                        throw new InvalidOperationException("O Windows não aceitou a entrada do chat.");
                }
                User32.INPUT Key(ushort vk, bool up) => new() { type = 1,
                    U = new User32.InputUnion { ki = new User32.KEYBDINPUT { wVk = vk, dwFlags = up ? 2u : 0u } } };
                Send(new[] { Key(0x59, false), Key(0x59, true) });
                await Task.Delay(250);
                var text = Message.SelectMany(c => new[] {
                    new User32.INPUT { type = 1, U = new User32.InputUnion { ki = new User32.KEYBDINPUT { wScan = c, dwFlags = 4 } } },
                    new User32.INPUT { type = 1, U = new User32.InputUnion { ki = new User32.KEYBDINPUT { wScan = c, dwFlags = 6 } } }
                }).ToArray();
                Send(text);
                await Task.Delay(100);
                Send(new[] { Key(0x0D, false), Key(0x0D, true) });
                status = "Entrada enviada uma vez. Confira a mensagem no chat do jogo.";
            }
            catch (Exception ex) { status = ex.Message; }
            finally { Volatile.Write(ref busy, 0); }
        });
    }
}
