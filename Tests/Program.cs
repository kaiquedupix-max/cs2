using System.Buffers.Binary;
using System.Diagnostics;
using System.Reflection;
using System.Text.RegularExpressions;
using Mac1ota_Menu.Classes;
using Mac1ota_Menu.Data.Game;
using Mac1ota_Menu.Modules.Combat;
using System.Numerics;

static void Check(bool condition, string message)
{
    if (!condition) throw new Exception(message);
}
static void Throws<T>(Action action) where T : Exception
{
    try { action(); } catch (T) { return; }
    throw new Exception("Expected " + typeof(T).Name);
}

if (args.Contains("--embedded"))
{
    string path = args[Array.IndexOf(args, "--embedded") + 1];
    string nativePath = args[Array.IndexOf(args, "--native") + 1];
    var assembly = Assembly.LoadFile(Path.GetFullPath(path));
    System.Runtime.CompilerServices.RuntimeHelpers.RunClassConstructor(assembly.GetType("Mac1ota_Menu.Classes.OffsetGetter")!.TypeHandle);
    using var resource = assembly.GetManifestResourceStream("legit_native.dll");
    Check(resource != null, "Native module embedded in loader");
    using var binary = new MemoryStream(); resource!.CopyTo(binary);
    Check(System.Security.Cryptography.SHA256.HashData(binary.ToArray()).SequenceEqual(System.Security.Cryptography.SHA256.HashData(File.ReadAllBytes(nativePath))), "Embedded native module matches checked build");
    using var notices = assembly.GetManifestResourceStream("native_notices.txt");
    Check(notices != null && notices.Length > 1000, "Native third-party notices embedded");
    Console.WriteLine("PASS: loader embeds the checked C++ module and third-party notices.");
}

if (args.Contains("--offsets-assembly"))
{
    var app = Assembly.LoadFile(Path.GetFullPath(args[Array.IndexOf(args, "--offsets-assembly") + 1]));
    var updater = app.GetType("Mac1ota_Menu.Classes.OffsetGetter")!;
    var clock = Stopwatch.StartNew();
    TextWriter original = Console.Out;
    try
    {
        Console.SetOut(TextWriter.Null);
        var task = (Task)updater.GetMethod("UpdateOffsetsAsync")!.Invoke(null, new object?[] { null })!;
        await task.WaitAsync(TimeSpan.FromSeconds(25));
    }
    finally { Console.SetOut(original); }
    var resolved = app.GetType("Mac1ota_Menu.Data.Game.Offsets")!;
    foreach (string field in new[] { "dwCSGOInput", "dwEntityList", "m_iHealth", "m_hOwnerEntity", "m_szCustomName", "m_AttributeManager" })
        Check((int)resolved.GetField(field)!.GetValue(null)! > 0, "Startup resolved " + field);
    Console.WriteLine($"PASS: actual offset download/parser completed in {clock.Elapsed.TotalSeconds:F2}s (no game access).");
}

byte[] attributes = SkinMaterialData.Attributes(344, 42, 0.125f);
Check(CosmeticModels.KnifePath(507) == "weapons/models/knife/knife_karambit/weapon_knife_karambit.vmdl", "Karambit model path");
Throws<ArgumentException>(() => CosmeticModels.KnifePath(7));
Check(CosmeticModels.Rarity("Covert") == 6 && CosmeticModels.Rarity("Restricted") == 4, "HUD rarity mapping");
var nameBytes = CosmeticModels.NameBytes(string.Concat(Enumerable.Repeat("皮肤", 100)));
Check(nameBytes.Length == 161 && nameBytes[160] == 0, "Bounded HUD name");
_ = new System.Text.UTF8Encoding(false, true).GetString(nameBytes.AsSpan(0, Array.IndexOf(nameBytes, (byte)0)));
var firstChoice = new Mac1ota_Menu.Modules.Visual.CosmeticLoadout.Choice(7, 0, 474, 1, .01f, false, "AK-47 | Aquamarine Revenge", 6, true, 123);
Mac1ota_Menu.Modules.Visual.CosmeticLoadout.Set(firstChoice);
var snapshot = Mac1ota_Menu.Modules.Visual.CosmeticLoadout.Choices;
Mac1ota_Menu.Modules.Visual.CosmeticLoadout.Set(firstChoice with { Paint = 801 });
Check(snapshot[0].Paint == 474 && Mac1ota_Menu.Modules.Visual.CosmeticLoadout.Choices.Count == 1, "Immutable snapshot and weapon replacement");
string profileJson = System.Text.Json.JsonSerializer.Serialize(Mac1ota_Menu.Modules.Visual.CosmeticLoadout.Choices);
var restored = System.Text.Json.JsonSerializer.Deserialize<List<Mac1ota_Menu.Modules.Visual.CosmeticLoadout.Choice>>(profileJson)!;
Check(restored[0].StatTrak && restored[0].Counter == 123 && restored[0].Paint == 801, "Cosmetic profile round trip");
Check(CosmeticModels.ModelLabel(5032, "Hand Wraps").StartsWith("Faixas"), "Hand wraps translation");
var nativePacket = NativeBridgeData.Config(restored, new(true, true, true, false, true, true, true, true, 720, 120, 1, 2, 3, 4, 5, 6, 7), 2);
Check(nativePacket.Length == 2132 && BinaryPrimitives.ReadUInt32LittleEndian(nativePacket.AsSpan(8)) == 2132, "Native config size ABI");
Check(BinaryPrimitives.ReadUInt32LittleEndian(nativePacket.AsSpan(12)) == 2 && BinaryPrimitives.ReadUInt32LittleEndian(nativePacket.AsSpan(28)) == 1, "Native generation and command feature ABI");
Check(BinaryPrimitives.ReadUInt32LittleEndian(nativePacket.AsSpan(84)) == 7 && BinaryPrimitives.ReadUInt32LittleEndian(nativePacket.AsSpan(108)) == 1 && BinaryPrimitives.ReadUInt32LittleEndian(nativePacket.AsSpan(112)) == 123, "Native cosmetic field ABI");
Throws<InvalidOperationException>(() => NativeBridgeData.Config(Enumerable.Repeat(firstChoice, 65).ToList(), new(true,false,false,false,false,false,false,false,720,120,1,2,3,4,5,6,7)));
Console.WriteLine("PASS: C# to C++ packet ABI, generation, feature flags and StatTrak payload.");
var cfg = new Newtonsoft.Json.Linq.JObject { ["Visual"] = new Newtonsoft.Json.Linq.JObject { ["CosmeticLoadout"] = new Newtonsoft.Json.Linq.JObject { ["Choices"] = Newtonsoft.Json.Linq.JToken.FromObject(restored) } } };
var cfgChoices = Newtonsoft.Json.Linq.JObject.Parse(cfg.ToString())["Visual"]!["CosmeticLoadout"]!["Choices"]!.ToObject<List<Mac1ota_Menu.Modules.Visual.CosmeticLoadout.Choice>>()!;
Check(cfgChoices[0] == restored[0], "Actual CFG serializer preserves selected skin, wear, seed and StatTrak");
var indexedSchema = SchemaOffsets.Parse("public static class One { public const nint field = 0x10; } public static class Two { public const nint field = 0x20; }");
Check(indexedSchema["One"]["field"] == 0x10 && indexedSchema["Two"]["field"] == 0x20, "Schema fields resolved by class without name collisions");
Console.WriteLine("PASS: actual CFG skin serialization and indexed schema parsing.");
Console.WriteLine("PASS: bounded UTF-8 names, knife metadata, rarity, loadout replacement and profile round trip.");
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

// The named console command skips a stock weapon with two empty material vectors.
// Fixture: its exact conditional/clear/rebuild instruction sequence, with relocated
// helper addresses. Reject changed control flow rather than calling guessed code.
byte[] dispatch = Convert.FromHexString("83BBB00A0000007F0983BBC80A0000007E18488D8B10060000B201E80000000033D2488BCBE800000000");
BitConverter.GetBytes(0x2000 - 0x1100 - 32).CopyTo(dispatch, 28);
BitConverter.GetBytes(0x3000 - 0x1100 - 42).CopyTo(dispatch, 38);
var plan = SkinMaterialData.DecodeRegenerationPlan(dispatch, 0x1100, 0x1000, 0x5000);
Check(plan.Clear == 0x2000 && plan.Rebuild == 0x3000 && plan.Component == 0x610, "Relocated material helpers");
Check(plan.CountA == 0xAB0 && plan.CountB == 0xAC8, "Material gate offsets decoded from callback");
Throws<InvalidOperationException>(() => SkinMaterialData.DecodeRegenerationPlan([], 0x1100, 0x1000, 0x5000));
Throws<InvalidOperationException>(() => SkinMaterialData.DecodeRegenerationPlan(dispatch.Concat(dispatch).ToArray(), 0x1100, 0x1000, 0x5000));
Throws<InvalidOperationException>(() => SkinMaterialData.DecodeRegenerationPlan(dispatch, 0x1100, 0x1000, 0x2500));
byte[] changedBranch = (byte[])dispatch.Clone(); changedBranch[17] = 0x17;
Throws<InvalidOperationException>(() => SkinMaterialData.DecodeRegenerationPlan(changedBranch, 0x1100, 0x1000, 0x5000));
byte[] call = SkinMaterialData.RebuildCall(0x100000, plan);
Check(call.Length == 65 && call.AsSpan(0, 4).SequenceEqual(new byte[] { 0x48, 0x83, 0xEC, 0x28 }), "x64 shadow space and alignment");
Check(BitConverter.ToInt64(call, 6) == 0x100610 && BitConverter.ToInt64(call, 33) == 0x100000, "Component and econ entity arguments");
Check(BitConverter.ToInt64(call, 21) == 0x2000 && BitConverter.ToInt64(call, 48) == 0x3000, "Clear/rebuild call targets");
Check(call.AsSpan(41, 5).SequenceEqual(new byte[] { 0xBA, 1, 0, 0, 0 }), "Force rebuild argument");
Check(call[^1] == 0xC3, "Material dispatch returns to its caller");
Throws<ArgumentOutOfRangeException>(() => SkinMaterialData.RebuildCall(0, plan));
Console.WriteLine("PASS: stock-weapon dispatch decoding, bounded helper targets and Windows x64 call ABI.");
byte[] setter = Convert.FromHexString("48895C24084889742410574883EC20488D9940010000488B7130488BFA48399308020000");
Check(SkinMaterialData.FindMeshSetter(setter, 0x7000, 0x140, 0x208) == 0x7000, "Native mesh setter with matching schema");
Throws<InvalidOperationException>(() => SkinMaterialData.FindMeshSetter(setter, 0x7000, 0x170, 0x208));
Throws<InvalidOperationException>(() => SkinMaterialData.FindMeshSetter(setter, 0x7000, 0x140, 0x210));
byte[] fullCall = SkinMaterialData.ApplyCall(0x100000, 0x110000, 0x120000, 2, 0x7000, plan);
Check(fullCall.Length == 321, "Native mesh notifications before and after forced rebuild");
Check(BitConverter.ToInt64(fullCall, 6) == 0x110000 && BitConverter.ToUInt64(fullCall, 16) == 1, "Force refresh stale legacy netvar through alternate group");
Throws<ArgumentException>(() => SkinMaterialData.ApplyCall(0x100000, 0, 0x120000, 2, 0x7000, plan));
Check(Vector3.Distance(RageMath.AimAngles(Vector3.Zero, new(100, 0, 0)), Vector3.Zero) < .001f, "Aim along X axis");
Check(Math.Abs(RageMath.AngleError(new(0, 179, 0), new(0, -179, 0)) - 2) < .01f, "FOV wraps yaw boundary");
Check(Math.Abs(RageMath.Step(new(0, 179, 0), new(0, -179, 0), 1).Y - 180) < .01f, "Shortest turn across yaw boundary");
Throws<ArgumentException>(() => RageMath.AimAngles(Vector3.Zero, Vector3.Zero));
Throws<ArgumentException>(() => RageMath.Step(new(float.NaN, 0, 0), Vector3.Zero, 1));
var nearAim = new RageMath.Point(1, 100, Vector3.One, Vector3.Zero, 1, 20, "Head");
var lowHealth = new RageMath.Point(2, 10, Vector3.One, Vector3.Zero, 5, 10, "Chest");
Check(RageMath.Select([nearAim, lowHealth], 0, 0)?.Pawn == 1, "Angular target priority");
Check(RageMath.Select([nearAim, lowHealth], 1, 0)?.Pawn == 2, "Health target priority");
Check(RageMath.Select([nearAim, lowHealth], 2, 0)?.Pawn == 2, "Distance target priority");
Check(RageMath.Select([nearAim, lowHealth], 0, 2)?.Pawn == 2, "Retain eligible locked target");
Check(RageMath.Select([nearAim, lowHealth with { Health = 0 }], 0, 2)?.Pawn == 1, "Release dead target");
Console.WriteLine("PASS: native render notifications, aim geometry, target priorities and target lock.");

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
        ["m_AttributeList"] = "C_EconItemView", ["m_Attributes"] = "CAttributeList",
        ["m_modelState"] = "CSkeletonInstance", ["m_MeshGroupMask"] = "CModelState"
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
