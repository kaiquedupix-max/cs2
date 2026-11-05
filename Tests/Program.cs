using System.Buffers.Binary;
using System.Diagnostics;
using System.Reflection;
using System.Text.RegularExpressions;
using Mac1ota_Menu.Classes;
using Mac1ota_Menu.Data.Game;

static void Check(bool condition, string message)
{
    if (!condition) throw new Exception(message);
}
static void Throws<T>(Action action) where T : Exception
{
    try { action(); } catch (T) { return; }
    throw new Exception("Expected " + typeof(T).Name);
}

byte[] attributes = SkinMaterialData.Attributes(344, 42, 0.125f);
Check(attributes.Length == 216, "Native attribute array size");
for (int i = 0; i < 3; i++)
{
    var bytes = attributes.AsSpan(i * 72, 72);
    Check(BinaryPrimitives.ReadUInt16LittleEndian(bytes[48..]) == 6 + i, "Attribute definition ABI");
    float expected = new float[] { 344, 42, 0.125f }[i];
    Check(BinaryPrimitives.ReadSingleLittleEndian(bytes[52..]) == expected, "Attribute value ABI");
    Check(BinaryPrimitives.ReadSingleLittleEndian(bytes[56..]) == expected, "Attribute initial value ABI");
    Check(bytes[..48].IndexOfAnyExcept((byte)0) < 0, "Zero initialized pointers/padding");
}
Throws<ArgumentOutOfRangeException>(() => SkinMaterialData.Attributes(0, 0, .1f));
Throws<ArgumentOutOfRangeException>(() => SkinMaterialData.Attributes(344, -1, .1f));
Throws<ArgumentOutOfRangeException>(() => SkinMaterialData.Attributes(344, 1001, .1f));
Throws<ArgumentOutOfRangeException>(() => SkinMaterialData.Attributes(344, 1, float.NaN));
Throws<ArgumentOutOfRangeException>(() => SkinMaterialData.Attributes(344, 1, float.PositiveInfinity));
Throws<ArgumentOutOfRangeException>(() => SkinMaterialData.Attributes(344, 1, 1.1f));
Check(SkinMaterialData.UniqueMatch([1, 2, 3, 4], [3, null]) == 2, "Signature at final valid position");
Check(SkinMaterialData.UniqueMatch([1], [1, 2]) == -1, "Short input");
Check(SkinMaterialData.UniqueMatch([1, 2], [8]) == -1, "Missing signature");
Throws<InvalidOperationException>(() => SkinMaterialData.UniqueMatch([1, 2, 1], [1]));
Throws<ArgumentException>(() => SkinMaterialData.UniqueMatch([1], []));
byte[] registration = new byte[128];
new byte[] { 0x48, 0x8D, 0x05, 0, 0, 0, 0, 0x48, 0x89, 0x44, 0x24, 0x30 }.CopyTo(registration, 0);
BitConverter.GetBytes(0x2000 - 0x1000 - 7).CopyTo(registration, 3);
new byte[] { 0x48, 0x8D, 0x15, 0, 0, 0, 0 }.CopyTo(registration, 24);
BitConverter.GetBytes(0x3000 - 0x1000 - 24 - 7).CopyTo(registration, 27);
Check(SkinMaterialSession.IsRegisteredCallback(registration, 0x1000, 0x2000, 0x3000), "Named command callback registration");
Check(!SkinMaterialSession.IsRegisteredCallback(registration, 0x1000, 0x2001, 0x3000), "Reject unrelated callback");
Check(!SkinMaterialSession.IsRegisteredCallback(registration, 0x1000, 0x2000, 0x3001), "Reject unrelated command");
Check(!SkinMaterialSession.IsRegisteredCallback(new byte[128], 0x1000, 0x2000, 0x3000), "Reject missing registration");
Console.WriteLine("PASS: native attribute ABI, invalid inputs, signature bounds/ambiguity, named callback identity.");

if (args.Contains("--analyze"))
{
    using var game = Process.GetProcessesByName("cs2").First();
    var module = game.Modules.Cast<ProcessModule>().Single(m => m.ModuleName == "client.dll");
    byte[] image = File.ReadAllBytes(module.FileName);
    using var peReader = new System.Reflection.PortableExecutable.PEReader(new MemoryStream(image));
    var headers = peReader.PEHeaders;
    byte[] name = System.Text.Encoding.ASCII.GetBytes("regenerate_weapon_skins\0");
    int rawString = image.AsSpan().IndexOf(name);
    Check(rawString >= 0, "Command name missing");
    var stringSection = headers.SectionHeaders.Single(s => rawString >= s.PointerToRawData && rawString < s.PointerToRawData + s.SizeOfRawData);
    int stringRva = rawString - stringSection.PointerToRawData + stringSection.VirtualAddress;
    Console.WriteLine($"Command string RVA: {stringRva:X}");
    var text = headers.SectionHeaders.Single(s => s.Name == ".text");
    for (int i = text.PointerToRawData; i < text.PointerToRawData + text.SizeOfRawData - 7; i++)
    {
        if ((image[i] == 0x48 || image[i] == 0x4C) && image[i + 1] == 0x8D && (image[i + 2] & 0xC7) == 5)
        {
            int rva = i - text.PointerToRawData + text.VirtualAddress;
            if (rva + 7 + BitConverter.ToInt32(image, i + 3) == stringRva)
            {
                Console.WriteLine($"XREF RVA {rva:X}: start {rva - 64:X} {Convert.ToHexString(image.AsSpan(i - 64, 160))}");
                for (int k = i - 64; k < i + 96; k++)
                {
                    if ((image[k] == 0x48 || image[k] == 0x4C) && image[k + 1] == 0x8D && (image[k + 2] & 0xC7) == 5)
                    {
                        int at = k - text.PointerToRawData + text.VirtualAddress;
                        int destination = at + 7 + BitConverter.ToInt32(image, k + 3);
                        Console.WriteLine($"  LEA {at:X}: {Convert.ToHexString(image.AsSpan(k, 7))} => {destination:X}");
                        if (destination >= text.VirtualAddress && destination < text.VirtualAddress + text.VirtualSize)
                            Console.WriteLine(Convert.ToHexString(image.AsSpan(destination - text.VirtualAddress + text.PointerToRawData, 160)));
                    }
                }
            }
        }
    }
}

// Optional read-only compatibility probe: never calls Apply or writes game memory.
if (args.Contains("--probe"))
{
    using var http = new HttpClient();
    string schema = await http.GetStringAsync("https://raw.githubusercontent.com/JulianG59/cs2-off/main/client_dll.cs");
    var classes = new Dictionary<string, string>
    {
        ["m_AttributeManager"] = "C_EconEntity", ["m_Item"] = "C_AttributeContainer",
        ["m_AttributeList"] = "C_EconItemView", ["m_Attributes"] = "CAttributeList"
    };
    foreach (var (field, type) in classes)
    {
        var block = Regex.Match(schema, @"public\s+static\s+class\s+" + type + @"\s*\{([\s\S]*?)\}");
        var value = Regex.Match(block.Groups[1].Value, @"public const nint " + field + @" = (0x[0-9A-Fa-f]+);");
        Check(value.Success, "Missing schema: " + type + "." + field);
        typeof(Offsets).GetField(field)!.SetValue(null, Convert.ToInt32(value.Groups[1].Value, 16));
    }
    using var game = Process.GetProcessesByName("cs2").First();
    var module = game.Modules.Cast<ProcessModule>().Single(m => m.ModuleName == "client.dll");
    using var session = new SkinMaterialSession(game.Id, module.BaseAddress);
    session.ResolveRegenerator();
    Console.WriteLine("PASS: material signature and named command callback match the running client.dll (read-only; no game writes).");
}
