// C# / MovementMath.cs / .NET 10 / Windows x64
namespace Mac1ota_Menu.Classes;

internal static class MovementMath
{
    internal static float Normalize(float angle) => MathF.IEEERemainder(angle, 360f);

    internal static float StrafeYaw(float velocityX, float velocityY, int direction)
    {
        float speed = MathF.Sqrt(velocityX * velocityX + velocityY * velocityY);
        float ideal = MathF.Asin(System.Math.Clamp(30f / MathF.Max(speed, 30f), 0f, 1f)) * 180f / MathF.PI;
        return Normalize(MathF.Atan2(velocityY, velocityX) * 180f / MathF.PI + direction * ideal);
    }
}
