using System.Numerics;
using Mac1ota_Menu.Modules.Combat;
using Mac1ota_Menu.Modules.Legit;

namespace Mac1ota_Menu.Classes;

internal static class AimTheme
{
    // Configuration intensity only; this does not estimate detection or ban probability.
    internal static float Intensity => !Aimbot.AimbotEnable ? 0 : System.Math.Clamp(.15f + (1 - System.Math.Clamp((Aimbot.SmoothingX + Aimbot.SmoothingY) / 40f, 0, 1)) * .45f +
            (!Aimbot.UseFOV ? .2f : System.Math.Clamp(Aimbot.FovSize / 1000f, 0, 1) * .2f), 0, 1);
    internal static Vector4 Accent
    {
        get
        {
            float t = Intensity * 3;
            Vector4[] stops = [new(.22f, .86f, .65f, 1), new(.95f, .83f, .2f, 1), new(1, .48f, .12f, 1), new(.95f, .16f, .18f, 1)];
            int i = System.Math.Min((int)t, 2);
            return Vector4.Lerp(stops[i], stops[i + 1], t - i);
        }
    }
    internal static string Warning => "Configuração agressiva: risco de banimento. Não nos responsabilizamos por banimentos.";
}
