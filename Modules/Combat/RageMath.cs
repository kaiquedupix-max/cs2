using System.Numerics;

namespace Mac1ota_Menu.Modules.Combat;

internal static class RageMath
{
    internal readonly record struct Point(nint Pawn, int Health, Vector3 Position, Vector3 Angles,
        float Error, float Distance, string Region);

    internal static bool Finite(Vector3 v) => float.IsFinite(v.X) && float.IsFinite(v.Y) && float.IsFinite(v.Z);
    internal static float Yaw(float value) => MathF.IEEERemainder(value, 360f);

    internal static Vector3 AimAngles(Vector3 eye, Vector3 point)
    {
        Vector3 d = point - eye;
        if (!Finite(eye) || !Finite(point) || d.LengthSquared() < .0001f)
            throw new ArgumentException("Ponto de mira inválido.");
        const float degrees = 180f / MathF.PI;
        return new(-MathF.Atan2(d.Z, MathF.Sqrt(d.X * d.X + d.Y * d.Y)) * degrees,
            MathF.Atan2(d.Y, d.X) * degrees, 0);
    }

    internal static float AngleError(Vector3 a, Vector3 b)
    {
        const float rad = MathF.PI / 180f;
        Vector3 Forward(Vector3 v) => new(MathF.Cos(v.X * rad) * MathF.Cos(v.Y * rad),
            MathF.Cos(v.X * rad) * MathF.Sin(v.Y * rad), -MathF.Sin(v.X * rad));
        if (!Finite(a) || !Finite(b)) return float.PositiveInfinity;
        return MathF.Acos(Math.Clamp(Vector3.Dot(Forward(a), Forward(b)), -1f, 1f)) / rad;
    }

    internal static Vector3 Step(Vector3 current, Vector3 desired, float limit)
    {
        if (!Finite(current) || !Finite(desired) || !float.IsFinite(limit))
            throw new ArgumentException("Ângulos inválidos.");
        Vector2 delta = new(desired.X - current.X, Yaw(desired.Y - current.Y));
        limit = Math.Clamp(limit, .1f, 180f);
        if (delta.Length() > limit) delta *= limit / delta.Length();
        return new(Math.Clamp(current.X + delta.X, -89f, 89f), Yaw(current.Y + delta.Y), 0);
    }

    internal static Point? Select(IEnumerable<Point> candidates, int priority, nint lockedPawn)
    {
        var points = candidates.Where(p => p.Pawn != 0 && p.Health > 0 && Finite(p.Position) &&
            Finite(p.Angles) && float.IsFinite(p.Error) && float.IsFinite(p.Distance)).ToArray();
        if (lockedPawn != 0 && points.Any(p => p.Pawn == lockedPawn))
            points = points.Where(p => p.Pawn == lockedPawn).ToArray();
        var ordered = priority switch
        {
            1 => points.OrderBy(p => p.Health).ThenBy(p => p.Error).ThenBy(p => p.Distance),
            2 => points.OrderBy(p => p.Distance).ThenBy(p => p.Error).ThenBy(p => p.Health),
            _ => points.OrderBy(p => p.Error).ThenBy(p => p.Health).ThenBy(p => p.Distance)
        };
        return ordered.Select(p => (Point?)p).FirstOrDefault();
    }
}
