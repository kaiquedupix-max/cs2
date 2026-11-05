using System.Text;
using Mac1ota_Menu.Modules.Visual;
namespace Mac1ota_Menu.Classes;
internal static class NativeBridgeData
{
    internal const uint Magic = 0x3542474c, Version = 1;
    internal const int ConfigSize = 2132, SharedSize = 2696, MessageOffset = 2184;
    internal sealed record Settings(bool Automatic, bool Spin, bool Silent, bool NoSpreadLocal, bool Bhop, bool Strafe, bool ThirdPerson, bool ChatSpam,
        float SpinSpeed, float ThirdDistance, int Input, int Controller, int Pawn, int Health, int Flags, int MoveType, int Velocity);
    internal static byte[] Config(IReadOnlyList<CosmeticLoadout.Choice> choices, Settings s, uint generation = 0)
    {
        if (choices.Count > 64) throw new InvalidOperationException("Limite de 64 escolhas por perfil.");
        byte[] data = new byte[ConfigSize];
        using var stream = new MemoryStream(data); using var w = new BinaryWriter(stream, Encoding.UTF8);
        void Bool(bool value) => w.Write(value ? 1u : 0u);
        w.Write(Magic); w.Write(Version); w.Write((uint)ConfigSize); w.Write(generation);
        Bool(s.Automatic); w.Write((uint)choices.Count); Bool(s.Spin); w.Write((s.Silent ? 1u : 0u) | (s.NoSpreadLocal ? 2u : 0u)); Bool(s.Bhop); Bool(s.Strafe); Bool(s.ThirdPerson); Bool(s.ChatSpam);
        w.Write(float.IsFinite(s.SpinSpeed) ? System.Math.Clamp(s.SpinSpeed, 1, 1440) : 720);
        w.Write(float.IsFinite(s.ThirdDistance) ? System.Math.Clamp(s.ThirdDistance, 40, 250) : 120);
        foreach (int offset in new[] { s.Input, s.Controller, s.Pawn, s.Health, s.Flags, s.MoveType, s.Velocity }) w.Write((uint)System.Math.Max(0, offset));
        foreach (var c in choices)
        {
            _ = SkinMaterialData.Attributes(c.Paint, c.Seed, c.Wear);
            if (c.Definition == 0 || c.Category is < 0 or > 2 || c.Counter < 0) throw new InvalidOperationException("Escolha inválida no perfil.");
            w.Write((uint)c.Definition); w.Write((uint)c.Category); w.Write((uint)c.Paint); w.Write((uint)c.Seed); w.Write(c.Wear);
            Bool(c.Legacy); Bool(c.StatTrak); w.Write((uint)c.Counter);
        }
        return data;
    }
}
