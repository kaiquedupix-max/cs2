using System.Buffers.Binary;

namespace Mac1ota_Menu.Classes;

// CEconItemAttribute layout used by the public ValorantTracker reference.
// Keep the serializer independent of process access so its ABI can be tested.
internal static class SkinMaterialData
{
    internal sealed record RegenerationPlan(nint Clear, nint Rebuild, int Component, int CountA, int CountB);

    internal static RegenerationPlan DecodeRegenerationPlan(byte[] body, nint bodyAddress, nint textStart, nint textEnd)
    {
        // Exact control flow from the registered command: test its two material
        // vectors, clear the material component, then rebuild this econ entity.
        byte?[] pattern = [0x83, 0xBB, null, null, null, null, 0, 0x7F, 9,
            0x83, 0xBB, null, null, null, null, 0, 0x7E, 0x18,
            0x48, 0x8D, 0x8B, null, null, null, null, 0xB2, 1,
            0xE8, null, null, null, null, 0x33, 0xD2, 0x48, 0x8B, 0xCB,
            0xE8, null, null, null, null];
        int at = UniqueMatch(body, pattern);
        if (at < 0) throw new InvalidOperationException("O fluxo de reconstrução de materiais mudou nesta versão do CS2.");
        int countA = BitConverter.ToInt32(body, at + 2), countB = BitConverter.ToInt32(body, at + 11);
        int component = BitConverter.ToInt32(body, at + 21);
        nint clear = bodyAddress + at + 32 + BitConverter.ToInt32(body, at + 28);
        nint rebuild = bodyAddress + at + 42 + BitConverter.ToInt32(body, at + 38);
        if (component is <= 0 or > 0x10000 || countA <= component || countB <= component ||
            countA > component + 0x1000 || countB > component + 0x1000 || countA == countB ||
            clear < textStart || clear >= textEnd || rebuild < textStart || rebuild >= textEnd || clear == rebuild)
            throw new InvalidOperationException("Plano de reconstrução de materiais inválido.");
        return new(clear, rebuild, component, countA, countB);
    }

    internal static byte[] RebuildCall(nint weapon, RegenerationPlan plan)
        => ApplyCall(weapon, 0, 0, 0, 0, plan);

    internal static nint FindMeshSetter(byte[] code, nint codeBase, int modelState, int meshMask)
    {
        byte?[] pattern = [0x48, 0x89, 0x5C, 0x24, null, 0x48, 0x89, 0x74, 0x24, null,
            0x57, 0x48, 0x83, 0xEC, null, 0x48, 0x8D, 0x99, null, null, null, null,
            0x48, 0x8B, 0x71];
        int at = UniqueMatch(code, pattern);
        if (at < 0 || at + 36 > code.Length || BitConverter.ToInt32(code, at + 18) != modelState ||
            code[at + 29] != 0x48 || code[at + 30] != 0x39 || code[at + 31] != 0x93 ||
            BitConverter.ToInt32(code, at + 32) != meshMask)
            throw new InvalidOperationException("A atualização nativa do modelo não foi validada para esta versão do CS2.");
        return codeBase + at;
    }

    internal static byte[] ApplyCall(nint weapon, nint worldNode, nint hudNode, ulong mask, nint meshSetter, RegenerationPlan plan)
    {
        if (weapon == 0) throw new ArgumentOutOfRangeException(nameof(weapon));
        using var stream = new MemoryStream();
        using var writer = new BinaryWriter(stream);
        // Windows x64 ABI: preserve stack alignment and reserve shadow space.
        writer.Write(new byte[] { 0x48, 0x83, 0xEC, 0x28 });
        void Mesh(nint node, ulong value)
        {
            writer.Write(new byte[] { 0x48, 0xB9 }); writer.Write((long)node);
            writer.Write(new byte[] { 0x48, 0xBA }); writer.Write(value);
            writer.Write(new byte[] { 0x48, 0xB8 }); writer.Write((long)meshSetter);
            writer.Write(new byte[] { 0xFF, 0xD0 });
        }
        void RefreshMeshes()
        {
            if (meshSetter == 0) return;
            if (worldNode == 0 || hudNode == 0 || mask is not (1UL or 2UL))
                throw new ArgumentException("Modelo de skin inválido.");
            // Earlier builds wrote the netvar without notifying the renderer.
            // Changing to the other legal group first defeats the setter's
            // early return when that stale netvar already equals the new mask.
            Mesh(worldNode, mask == 1 ? 2UL : 1UL); Mesh(worldNode, mask);
            Mesh(hudNode, mask == 1 ? 2UL : 1UL); Mesh(hudNode, mask);
        }
        RefreshMeshes();
        writer.Write(new byte[] { 0x48, 0xB9 }); writer.Write((long)(weapon + plan.Component));
        writer.Write(new byte[] { 0xBA, 1, 0, 0, 0 });
        writer.Write(new byte[] { 0x48, 0xB8 }); writer.Write((long)plan.Clear);
        writer.Write(new byte[] { 0xFF, 0xD0 });
        writer.Write(new byte[] { 0x48, 0xB9 }); writer.Write((long)weapon);
        writer.Write(new byte[] { 0xBA, 1, 0, 0, 0 }); // force rebuild
        writer.Write(new byte[] { 0x48, 0xB8 }); writer.Write((long)plan.Rebuild);
        writer.Write(new byte[] { 0xFF, 0xD0 });
        RefreshMeshes();
        writer.Write(new byte[] { 0x48, 0x83, 0xC4, 0x28, 0x33, 0xC0, 0xC3 });
        return stream.ToArray();
    }

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
