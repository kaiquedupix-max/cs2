using System.Text;

namespace Mac1ota_Menu.Classes;

internal static class CosmeticModels
{
    internal static bool IsKnife(ushort id) => id is 42 or 59 || id is >= 500 and <= 526;
    internal static string KnifePath(ushort id)
    {
        string model = id switch
        {
            500 => "bayonet", 503 => "css", 505 => "flip", 506 => "gut", 507 => "karambit",
            508 => "m9", 509 => "tactical", 512 => "falchion", 514 => "bowie", 515 => "butterfly",
            516 => "push", 517 => "cord", 518 => "canis", 519 => "ursus", 520 => "navaja",
            521 => "outdoor", 522 => "stiletto", 523 => "talon", 525 => "skeleton", 526 => "kukri",
            _ => throw new ArgumentException("Modelo de faca não suportado.")
        };
        return $"weapons/models/knife/knife_{model}/weapon_knife_{model}.vmdl";
    }

    internal static byte[] NameBytes(string name)
    {
        byte[] bytes = new byte[161];
        Encoding.UTF8.GetEncoder().Convert(name.AsSpan(), bytes.AsSpan(0, 160), true, out _, out _, out _);
        return bytes;
    }

    internal static int Rarity(string name) => name switch
    {
        "Consumer Grade" => 1, "Industrial Grade" => 2, "Mil-Spec Grade" => 3,
        "Restricted" => 4, "Classified" => 5, "Covert" or "Extraordinary" => 6, _ => 0
    };

    internal static uint SubclassHash(ushort definition)
    {
        ReadOnlySpan<byte> data = Encoding.ASCII.GetBytes(definition.ToString(System.Globalization.CultureInfo.InvariantCulture));
        const uint m = 0x5BD1E995;
        uint hash = 0x31415926 ^ (uint)data.Length;
        int at = 0;
        while (data.Length - at >= 4)
        {
            uint k = System.Buffers.Binary.BinaryPrimitives.ReadUInt32LittleEndian(data[at..]);
            k *= m; k ^= k >> 24; k *= m; hash = hash * m ^ k; at += 4;
        }
        int left = data.Length - at;
        if (left >= 3) hash ^= (uint)data[at + 2] << 16;
        if (left >= 2) hash ^= (uint)data[at + 1] << 8;
        if (left >= 1) { hash ^= data[at]; hash *= m; }
        hash ^= hash >> 13; hash *= m; hash ^= hash >> 15;
        return hash;
    }
}
