using System.Buffers.Binary;

namespace Mac1ota_Menu.Classes;

// CEconItemAttribute layout used by the public ValorantTracker reference.
// Keep the serializer independent of process access so its ABI can be tested.
internal static class SkinMaterialData
{
    internal const int AttributeSize = 0x48;

    internal static byte[] Attributes(int paint, int seed, float wear)
    {
        if (paint <= 0 || seed is < 0 or > 1000 || !float.IsFinite(wear) || wear is < 0 or > 1)
            throw new ArgumentOutOfRangeException(nameof(paint), "Atributos de skin inválidos.");
        byte[] result = new byte[3 * AttributeSize];
        float[] values = [paint, seed, wear];
        for (int i = 0; i < values.Length; i++)
        {
            var attribute = result.AsSpan(i * AttributeSize, AttributeSize);
            BinaryPrimitives.WriteUInt16LittleEndian(attribute[0x30..], (ushort)(6 + i));
            BinaryPrimitives.WriteSingleLittleEndian(attribute[0x34..], values[i]);
            BinaryPrimitives.WriteSingleLittleEndian(attribute[0x38..], values[i]);
        }
        return result;
    }

    internal static int UniqueMatch(ReadOnlySpan<byte> data, byte?[] pattern)
    {
        if (pattern.Length == 0) throw new ArgumentException("Assinatura vazia.");
        int found = -1;
        for (int i = 0; i <= data.Length - pattern.Length; i++)
        {
            int j = 0;
            for (; j < pattern.Length; j++)
                if (pattern[j] is byte value && value != data[i + j]) break;
            if (j != pattern.Length) continue;
            if (found >= 0) throw new InvalidOperationException("Assinatura de materiais ambígua nesta versão do CS2.");
            found = i;
        }
        return found;
    }
}
