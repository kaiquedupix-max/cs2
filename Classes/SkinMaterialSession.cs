using System.ComponentModel;
using System.Diagnostics;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Win32.SafeHandles;
using Mac1ota_Menu.Data.Game;

namespace Mac1ota_Menu.Classes;

// Uses the game's existing material regeneration routine, not an injected DLL.
// Reference: https://github.com/ValorantTracker/cs2-skin-changer (MIT).
internal sealed class SkinMaterialSession : IDisposable
{
    private readonly SafeProcessHandle process;
    private readonly nint client;
    private readonly int processId;
    private byte[]? clientCode;
    private nint clientCodeBase;
    private nint setModel, updateSubclass, gameAlloc;
    private readonly Dictionary<nint, nint> gloveAttributes = new();
    private readonly Dictionary<(nint Weapon, nint Hud), ushort> knifeModels = new();
    internal void InvalidateEntityCaches()
    {
        knifeModels.Clear();
        gloveAttributes.Clear();
    }

    internal void MaintainItemIdentity(nint weapon)
    {
        if (Offsets.m_iAccountID <= 0 || Offsets.m_OriginalOwnerXuidLow <= 0 ||
            Offsets.m_iItemID <= 0 || Offsets.m_iItemIDLow <= 0 || Offsets.m_bVisualsDataSet <= 0)
            throw new InvalidOperationException("Dados de identidade da skin indisponíveis.");
        nint item = weapon + Offsets.m_AttributeManager + Offsets.m_Item;
        uint owner = Read<uint>(weapon + Offsets.m_OriginalOwnerXuidLow);
        bool changed = false;
        void Set<T>(nint address, T value) where T : unmanaged
        { if (!Read<T>(address).Equals(value)) { Write(address, value); changed = true; } }
        Set(item + Offsets.m_iAccountID, owner);
        Set(item + Offsets.m_iItemID, 1UL);
        Set(item + Offsets.m_iItemIDLow, 1u);
        Set(item + Offsets.m_iItemIDHigh, uint.MaxValue);
        if (changed) Write(weapon + Offsets.m_bVisualsDataSet, (byte)0);
    }

    internal bool RequestHudRefresh()
    {
        if (Offsets.dwNetworkGameClient <= 0 || Offsets.dwNetworkGameClient_signOnState <= 0 ||
            Offsets.dwNetworkGameClient_deltaTick <= 0) return false;
        using var target = Process.GetProcessById(processId);
        var module = target.Modules.Cast<ProcessModule>().FirstOrDefault(m => m.ModuleName.Equals("engine2.dll", StringComparison.OrdinalIgnoreCase));
        if (module == null) return false;
        nint network = Read<nint>(module.BaseAddress + Offsets.dwNetworkGameClient);
        if (network == 0 || Read<int>(network + Offsets.dwNetworkGameClient_signOnState) != 6) return false;
        Write(network + Offsets.dwNetworkGameClient_deltaTick, -1);
        return true;
    }
    private nint regenerate;
    private nint meshSetter;
    private SkinMaterialData.RegenerationPlan? regenerationPlan;
    internal bool TimedOut { get; private set; }

    internal SkinMaterialSession(int pid, nint clientBase)
    {
        using var target = Process.GetProcessById(pid);
        if (target.HasExited || !target.ProcessName.Equals("cs2", StringComparison.OrdinalIgnoreCase))
            throw new InvalidOperationException("O processo do CS2 não está disponível.");
        client = clientBase;
        processId = pid;
        process = OpenProcess(0x10043A, false, pid);
        if (process.IsInvalid) throw new Win32Exception(Marshal.GetLastWin32Error(), "Não foi possível acessar o CS2.");
    }

    internal T Read<T>(nint address) where T : unmanaged
    {
        byte[] bytes = ReadBytes(address, Marshal.SizeOf<T>());
        return MemoryMarshal.Read<T>(bytes);
    }

    private byte[] ReadBytes(nint address, int size)
    {
        if (address == 0 || size <= 0) throw new InvalidOperationException("Endereço de skin inválido.");
        byte[] bytes = new byte[size];
        if (!ReadProcessMemory(process, address, bytes, (nuint)size, out var read) || read != (nuint)size)
            throw new Win32Exception(Marshal.GetLastWin32Error(), "Falha ao ler os dados da arma.");
        return bytes;
    }

    internal void Write<T>(nint address, T value) where T : unmanaged
    {
        byte[] bytes = new byte[Marshal.SizeOf<T>()];
        MemoryMarshal.Write(bytes, in value);
        WriteBytes(address, bytes);
    }

    private void WriteBytes(nint address, byte[] bytes)
    {
        if (address == 0) throw new InvalidOperationException("Endereço de skin inválido.");
        if (!WriteProcessMemory(process, address, bytes, (nuint)bytes.Length, out var written) || written != (nuint)bytes.Length)
            throw new Win32Exception(Marshal.GetLastWin32Error(), "Falha ao gravar os dados da skin.");
    }

    internal nint Entity(nint list, uint handle)
    {
        if (handle is 0 or uint.MaxValue || list == 0) return 0;
        nint page = Read<nint>(list + 0x10 + 8 * (int)((handle & 0x7FFF) >> 9));
        return page == 0 ? 0 : Read<nint>(page + 0x70 * (int)(handle & 0x1FF));
    }

    internal void ResolveRegenerator()
    {
        if (regenerate != 0) return;
        // Scan only the executable .text section, and require exactly one match.
        if (Read<ushort>(client) != 0x5A4D) throw new InvalidOperationException("client.dll inválida.");
        int pe = Read<int>(client + 0x3C);
        if (pe is < 0x40 or > 0x100000 || Read<uint>(client + pe) != 0x4550)
            throw new InvalidOperationException("Cabeçalho de client.dll inválido.");
        int sections = Read<ushort>(client + pe + 6);
        int optionalSize = Read<ushort>(client + pe + 20);
        nint sectionTable = client + pe + 24 + optionalSize;
        nint commandName = 0;
        byte?[] signature = [0x48, 0x83, 0xEC, null, 0xE8, null, null, null, null,
            0x48, 0x85, 0xC0, 0x0F, 0x84, null, null, null, null, 0x48, 0x8B, 0x10];
        if (sections is < 1 or > 96) throw new InvalidOperationException("Seções de client.dll inválidas.");
        byte?[] name = Encoding.ASCII.GetBytes("regenerate_weapon_skins\0").Select(b => (byte?)b).ToArray();
        for (int i = 0; i < sections; i++)
        {
            nint section = sectionTable + i * 40;
            if (Read<uint>(section) != 0x6164722E) continue; // .rdata
            int size = Read<int>(section + 8), rva = Read<int>(section + 12);
            if (size is <= 0 or > 128 * 1024 * 1024 || rva <= 0) continue;
            int match = SkinMaterialData.UniqueMatch(ReadBytes(client + rva, size), name);
            if (match >= 0) commandName = client + rva + match;
        }
        if (commandName == 0) throw new InvalidOperationException("Comando de regeneração não encontrado nesta versão do CS2.");
        for (int i = 0; i < sections; i++)
        {
            nint section = sectionTable + i * 40;
            if (Read<uint>(section) != 0x7865742E || Read<byte>(section + 4) != (byte)'t') continue;
            int size = Read<int>(section + 8);
            int rva = Read<int>(section + 12);
            if (size is <= 0 or > 128 * 1024 * 1024 || rva <= 0)
                throw new InvalidOperationException("Seção de materiais inválida.");
            byte[] code = ReadBytes(client + rva, size);
            clientCode = code; clientCodeBase = client + rva;
            int match = SkinMaterialData.UniqueMatch(code, signature);
            if (match < 0) break;
            nint candidate = client + rva + match;
            // Verify the callback registered for the exact named console command.
            // A prologue alone is insufficient. In particular, +0x52 from the old
            // reference is now part of an instruction, NOT an attribute offset.
            if (!IsRegisteredCallback(code, client + rva, candidate, commandName))
                throw new InvalidOperationException("Não foi possível validar a rotina de materiais desta versão do CS2.");
            regenerationPlan = SkinMaterialData.DecodeRegenerationPlan(ReadBytes(candidate, 0x150), candidate, client + rva, client + rva + size);
            meshSetter = SkinMaterialData.FindMeshSetter(code, client + rva, Offsets.m_modelState, Offsets.m_MeshGroupMask);
            regenerate = candidate;
            return;
        }
        throw new InvalidOperationException("Rotina de materiais não encontrada nesta versão do CS2.");
    }

    internal static bool IsRegisteredCallback(byte[] code, nint codeBase, nint callback, nint commandName)
    {
        for (int i = 0; i + 80 < code.Length; i++)
        {
            // lea rax, callback; mov [rsp+30h], rax
            if (code[i] != 0x48 || code[i + 1] != 0x8D || code[i + 2] != 0x05 ||
                code[i + 7] != 0x48 || code[i + 8] != 0x89 || code[i + 9] != 0x44 ||
                code[i + 10] != 0x24 || code[i + 11] != 0x30) continue;
            if (codeBase + i + 7 + BitConverter.ToInt32(code, i + 3) != callback) continue;
            for (int j = i + 12; j < i + 72; j++)
            {
                // lea rdx, "regenerate_weapon_skins"
                if (code[j] == 0x48 && code[j + 1] == 0x8D && code[j + 2] == 0x15 &&
                    codeBase + j + 7 + BitConverter.ToInt32(code, j + 3) == commandName) return true;
            }
        }
        return false;
    }

    private nint HudWeapon(nint pawn, nint list, nint weapon)
    {
        nint arms = Entity(list, Read<uint>(pawn + Offsets.m_hHudModelArms));
        if (arms == 0) return 0;
        nint node = Read<nint>(arms + Offsets.m_pGameSceneNode);
        if (node == 0) return 0;
        nint child = Read<nint>(node + Offsets.m_pChild);
        var visited = new HashSet<nint>();
        while (child != 0 && visited.Count < 128 && visited.Add(child))
        {
            nint owner = Read<nint>(child + Offsets.m_pOwner);
            if (owner != 0 && Entity(list, Read<uint>(owner + Offsets.m_hOwnerEntity)) == weapon) return owner;
            child = Read<nint>(child + Offsets.m_pNextSibling);
        }
        return 0;
    }

    private nint FindFunction(byte?[] pattern)
    {
        ResolveRegenerator();
        int at = SkinMaterialData.UniqueMatch(clientCode!, pattern);
        if (at < 0) throw new InvalidOperationException("A função nativa do modelo não está disponível nesta versão do CS2.");
        return clientCodeBase + at;
    }

    private nint CallNative(nint function, nint first = 0, nint second = 0)
    {
        if (TimedOut || function == 0) throw new InvalidOperationException("Chamada de cosmético indisponível.");
        nint block = VirtualAllocEx(process, 0, 8192, 0x3000, 0x04);
        if (block == 0) throw new Win32Exception(Marshal.GetLastWin32Error());
        try
        {
            using var stream = new MemoryStream(); using var writer = new BinaryWriter(stream);
            writer.Write(new byte[] { 0x48, 0x83, 0xEC, 0x28, 0x48, 0xB9 }); writer.Write((long)first);
            writer.Write(new byte[] { 0x48, 0xBA }); writer.Write((long)second);
            writer.Write(new byte[] { 0x48, 0xB8 }); writer.Write((long)function);
            writer.Write(new byte[] { 0xFF, 0xD0, 0x48, 0xB9 }); writer.Write((long)(block + 4096));
            writer.Write(new byte[] { 0x48, 0x89, 0x01, 0x48, 0x83, 0xC4, 0x28, 0x33, 0xC0, 0xC3 });
            byte[] code = stream.ToArray(); WriteBytes(block, code);
            if (!VirtualProtectEx(process, block, 4096, 0x20, out _) || !FlushInstructionCache(process, block, (nuint)code.Length))
                throw new Win32Exception(Marshal.GetLastWin32Error());
            using var thread = CreateRemoteThread(process, 0, 0, block, 0, 0, out _);
            if (thread.IsInvalid) throw new Win32Exception(Marshal.GetLastWin32Error());
            if (WaitForSingleObject(thread, 10000) != 0)
            { TimedOut = true; throw new InvalidOperationException("Cosmético excedeu o tempo limite. Reinicie o CS2."); }
            if (!GetExitCodeThread(thread, out uint codeResult) || codeResult >= 0x80000000)
                throw new InvalidOperationException("A função nativa do cosmético falhou.");
            return Read<nint>(block + 4096);
        }
        finally { if (!TimedOut) VirtualFreeEx(process, block, 0, 0x8000); }
    }

    private nint GameAlloc()
    {
        if (gameAlloc != 0) return gameAlloc;
        using var target = Process.GetProcessById(processId);
        var module = target.Modules.Cast<ProcessModule>().Single(m => m.ModuleName.Equals("tier0.dll", StringComparison.OrdinalIgnoreCase));
        nint start = module.BaseAddress;
        int pe = Read<int>(start + 0x3C);
        if (pe is < 64 or > 0x100000 || Read<uint>(start + pe) != 0x4550) throw new InvalidOperationException("tier0.dll inválida.");
        int exportRva = Read<int>(start + pe + 0x88), exportSize = Read<int>(start + pe + 0x8C);
        nint exports = start + exportRva;
        int count = Read<int>(exports + 24);
        if (count is < 1 or > 100000) throw new InvalidOperationException("Exportações de tier0.dll inválidas.");
        nint names = start + Read<int>(exports + 32), ordinals = start + Read<int>(exports + 36), functions = start + Read<int>(exports + 28);
        for (int i = 0; i < count; i++)
        {
            nint name = start + Read<int>(names + i * 4);
            byte[] bytes = ReadBytes(name, 64); int end = Array.IndexOf(bytes, (byte)0);
            if (end < 0 || Encoding.ASCII.GetString(bytes, 0, end) != "MemAlloc_AllocFunc") continue;
            ushort ordinal = Read<ushort>(ordinals + i * 2);
            int rva = Read<int>(functions + ordinal * 4);
            if (rva <= 0 || rva >= module.ModuleMemorySize || (rva >= exportRva && rva < exportRva + exportSize)) break;
            return gameAlloc = start + rva;
        }
        throw new InvalidOperationException("O alocador de atributos do jogo não foi encontrado.");
    }

    internal void ChangeKnife(nint pawn, nint list, uint handle, ushort definition)
    {
        string path = CosmeticModels.KnifePath(definition);
        if (Offsets.m_nSubclassID <= 0 || Offsets.m_iEntityQuality <= 0) throw new InvalidOperationException("Dados do modelo da faca indisponíveis.");
        nint weapon = Entity(list, handle);
        nint item = weapon + Offsets.m_AttributeManager + Offsets.m_Item;
        if (weapon == 0 || !CosmeticModels.IsKnife(Read<ushort>(item + Offsets.m_iItemDefinitionIndex)))
            throw new InvalidOperationException("Equipe sua faca antes de aplicar o modelo.");
        nint hud = HudWeapon(pawn, list, weapon);
        if (hud == 0) throw new InvalidOperationException("Modelo da faca em primeira pessoa indisponível.");
        var modelKey = (weapon, hud);
        if (knifeModels.TryGetValue(modelKey, out ushort applied) && applied == definition &&
            Read<ushort>(item + Offsets.m_iItemDefinitionIndex) == definition &&
            Read<uint>(weapon + Offsets.m_nSubclassID) == CosmeticModels.SubclassHash(definition)) return;
        if (setModel == 0) setModel = FindFunction([0x40, 0x53, 0x48, 0x83, 0xEC, null, 0x48, 0x8B, 0xD9, 0x4C, 0x8B, 0xC2, 0x48, 0x8B, 0x0D, null, null, null, null, 0x48, 0x8D, 0x54, 0x24, 0x40]);
        if (updateSubclass == 0) updateSubclass = FindFunction([0x4C, 0x8B, 0xDC, 0x53, 0x48, 0x81, 0xEC, null, null, null, null, 0x48, 0x8B, 0x41]);
        nint text = VirtualAllocEx(process, 0, 4096, 0x3000, 0x04);
        if (text == 0) throw new Win32Exception(Marshal.GetLastWin32Error());
        try
        {
            WriteBytes(text, Encoding.UTF8.GetBytes(path + "\0"));
            Write(item + Offsets.m_iItemDefinitionIndex, definition);
            Write(item + Offsets.m_iEntityQuality, 3);
            Write(weapon + Offsets.m_nSubclassID, CosmeticModels.SubclassHash(definition));
            CallNative(updateSubclass, weapon);
            CallNative(setModel, weapon, text); CallNative(setModel, hud, text);
            if (knifeModels.Count >= 128) knifeModels.Clear();
            knifeModels[modelKey] = definition;
        }
        finally { if (!TimedOut) VirtualFreeEx(process, text, 0, 0x8000); }
    }

    internal bool ModelsReady(nint pawn, nint list, nint weapon)
    {
        nint hud = HudWeapon(pawn, list, weapon);
        return hud != 0 && Read<nint>(weapon + Offsets.m_pGameSceneNode) != 0 && Read<nint>(hud + Offsets.m_pGameSceneNode) != 0;
    }

    internal CosmeticTarget CaptureTarget(nint pawn, nint list, uint handle, long revision)
    {
        nint weapon = Entity(list, handle);
        byte team = Read<byte>(pawn + Offsets.m_iTeamNum);
        if (weapon == 0 || team is not (2 or 3) || Read<int>(pawn + Offsets.m_iHealth) <= 0 ||
            Read<nint>(client + Offsets.dwLocalPlayerPawn) != pawn ||
            Read<byte>(pawn + Offsets.m_bIsBuyMenuOpen) != 0 ||
            Entity(list, Read<uint>(weapon + Offsets.m_hOwnerEntity)) != pawn)
            throw new InvalidOperationException("Aguardando arma equipada e jogador estável.");
        nint services = Read<nint>(pawn + Offsets.m_pWeaponServices);
        if (services == 0 || Read<uint>(services + Offsets.m_hActiveWeapon) != handle)
            throw new InvalidOperationException("A arma equipada mudou.");
        nint hud = HudWeapon(pawn, list, weapon);
        nint worldNode = Read<nint>(weapon + Offsets.m_pGameSceneNode);
        nint hudNode = hud == 0 ? 0 : Read<nint>(hud + Offsets.m_pGameSceneNode);
        if (hud == 0 || worldNode == 0 || hudNode == 0)
            throw new InvalidOperationException("Aguardando os modelos da arma.");
        return new(pawn, team, handle, weapon, hud, worldNode, hudNode, revision);
    }

    internal bool MaterialsMatch(nint pawn, nint list, nint weapon, int paint, int seed, float wear, bool legacy)
    {
        if (regenerationPlan == null) return false;
        nint hud = HudWeapon(pawn, list, weapon);
        nint item = weapon + Offsets.m_AttributeManager + Offsets.m_Item;
        ulong mask = legacy ? 2UL : 1UL;
        return hud != 0 && Read<ulong>(MeshAddress(weapon)) == mask && Read<ulong>(MeshAddress(hud)) == mask &&
            Read<int>(weapon + regenerationPlan.CountA) + Read<int>(weapon + regenerationPlan.CountB) > 0;
    }

    internal bool GlovesMatch(nint pawn, ushort definition, int paint, int seed, float wear)
    {
        if (Offsets.m_EconGloves <= 0) return false;
        nint item = pawn + Offsets.m_EconGloves;
        if (Read<ushort>(item + Offsets.m_iItemDefinitionIndex) != definition ||
            Read<byte>(item + Offsets.m_bInitialized) != 1 ||
            Read<byte>(item + Offsets.m_bDisallowSOC) != 1 ||
            Read<int>(item + Offsets.m_iItemIDHigh) != -1) return false;
        return GloveVectorMatches(item + Offsets.m_AttributeList + Offsets.m_Attributes, paint, seed, wear) &&
            Offsets.m_NetworkedDynamicAttributes > 0 &&
            GloveVectorMatches(item + Offsets.m_NetworkedDynamicAttributes + Offsets.m_Attributes, paint, seed, wear);
    }

    private bool GloveVectorMatches(nint vector, int paint, int seed, float wear)
    {
        if (Read<ulong>(vector) != 3) return false;
        nint data = Read<nint>(vector + 8);
        return data != 0 && Read<ushort>(data + 0x30) == 6 &&
            Read<ushort>(data + 0x48 + 0x30) == 7 && Read<ushort>(data + 0x90 + 0x30) == 8 &&
            Read<float>(data + 0x34) == paint && Read<float>(data + 0x48 + 0x34) == seed &&
            System.Math.Abs(Read<float>(data + 0x90 + 0x34) - wear) < .0001f;
    }

    internal void SetHudName(nint weapon, string name, int rarity, bool invalidate = false)
    {
        if (string.IsNullOrWhiteSpace(name)) return;
        if (Offsets.m_szCustomName <= 0 || Offsets.m_szCustomNameOverride <= 0 || Offsets.m_iRarityOverride <= 0)
            throw new InvalidOperationException("Dados do nome da skin indisponíveis.");
        nint item = weapon + Offsets.m_AttributeManager + Offsets.m_Item;
        byte[] bytes = CosmeticModels.NameBytes(name);
        int expectedRarity = System.Math.Clamp(rarity, 0, 7);
        int[] nameFields = [Offsets.m_szCustomName, Offsets.m_szCustomNameOverride,
            Offsets.m_szCustomNameOverride2, Offsets.m_szCustomNameOverride3];
        bool changed = invalidate || Read<int>(item + Offsets.m_iRarityOverride) != expectedRarity;
        foreach (int offset in nameFields.Where(offset => offset > 0).Distinct())
        {
            if (ReadBytes(item + offset, bytes.Length).AsSpan().SequenceEqual(bytes)) continue;
            WriteBytes(item + offset, bytes);
            changed = true;
        }
        if (!changed) return;
        Write(item + Offsets.m_iRarityOverride, expectedRarity);
        if (Offsets.m_bInitializedTags > 0) Write(item + Offsets.m_bInitializedTags, (byte)0);
    }

    internal void SetStatTrak(nint weapon, bool enabled, int counter, bool knife)
    {
        if (Offsets.m_nFallbackStatTrak <= 0 || Offsets.m_iEntityQuality <= 0)
            throw new InvalidOperationException("Dados de StatTrak indisponíveis nesta versão do CS2.");
        Write(weapon + Offsets.m_nFallbackStatTrak, enabled ? System.Math.Max(0, counter) : -1);
        Write(weapon + Offsets.m_AttributeManager + Offsets.m_Item + Offsets.m_iEntityQuality, enabled ? 9 : knife ? 3 : 4);
    }

    internal void ApplyGloves(nint pawn, ushort definition, int paint, int seed, float wear)
    {
        if (!(definition == 4725 || definition is >= 5027 and <= 5035) || Offsets.m_EconGloves <= 0 || Offsets.m_bNeedToReApplyGloves <= 0 ||
            Offsets.m_bInitialized <= 0 || Offsets.m_bDisallowSOC <= 0 || Offsets.m_iEntityQuality <= 0 ||
            Offsets.m_NetworkedDynamicAttributes <= 0 || Offsets.m_nEconGlovesChanged <= 0 ||
            Offsets.m_iItemID <= 0 || Offsets.m_iItemIDLow <= 0)
            throw new InvalidOperationException("Modelo ou dados das luvas indisponíveis.");
        nint item = pawn + Offsets.m_EconGloves;
        nint[] vectors = [item + Offsets.m_AttributeList + Offsets.m_Attributes,
            item + Offsets.m_NetworkedDynamicAttributes + Offsets.m_Attributes];
        // Validate both lists before modifying either. Each list owns its own allocation.
        foreach (nint vector in vectors) ValidateGloveVector(item, vector);
        Write(item + Offsets.m_bInitialized, (byte)0);
        foreach (nint vector in vectors) PublishGloveVector(item, vector, paint, seed, wear);
        Write(item + Offsets.m_iItemDefinitionIndex, definition);
        Write(item + Offsets.m_iItemID, ulong.MaxValue);
        Write(item + Offsets.m_iItemIDHigh, -1);
        Write(item + Offsets.m_iItemIDLow, -1);
        Write(item + Offsets.m_iEntityQuality, 3);
        Write(item + Offsets.m_bDisallowSOC, (byte)1);
        Write(item + Offsets.m_bInitialized, (byte)1);
        Write(pawn + Offsets.m_nEconGlovesChanged,
            unchecked((byte)(Read<byte>(pawn + Offsets.m_nEconGlovesChanged) + 1)));
        Write(pawn + Offsets.m_bNeedToReApplyGloves, (byte)1);
    }

    private bool ValidateGloveVector(nint item, nint vector)
    {
        ulong count = Read<ulong>(vector); nint pointer = Read<nint>(vector + 8);
        bool ours = gloveAttributes.TryGetValue(vector, out nint owned) && owned == pointer && count == 3;
        if (!ours && count == 3 && pointer != 0 && Read<byte>(item + Offsets.m_bDisallowSOC) == 1 &&
            Read<ushort>(pointer + 0x30) == 6 && Read<ushort>(pointer + 0x48 + 0x30) == 7 &&
            Read<ushort>(pointer + 0x90 + 0x30) == 8) ours = true;
        if ((count != 0 || pointer != 0) && !ours) throw new InvalidOperationException("As luvas atuais possuem atributos próprios. Use luvas padrão antes de substituir.");
        return ours;
    }

    private void PublishGloveVector(nint item, nint vector, int paint, int seed, float wear)
    {
        bool ours = ValidateGloveVector(item, vector);
        nint pointer = Read<nint>(vector + 8);
        if (!ours)
        {
            pointer = CallNative(GameAlloc(), (nint)(SkinMaterialData.AttributeSize * 3));
            if (pointer.ToInt64() < 65536) throw new InvalidOperationException("Falha ao alocar atributos das luvas.");
        }
        WriteBytes(pointer, SkinMaterialData.Attributes(paint, seed, wear));
        Write(vector + 8, pointer); Write(vector, 3UL); gloveAttributes[vector] = pointer;
        // The vector uses tier0's allocator. The game owns its lifetime and may
        // release it normally when the pawn/econ item is destroyed.
    }

    private nint MeshAddress(nint entity)
    {
        nint node = Read<nint>(entity + Offsets.m_pGameSceneNode);
        if (node == 0) throw new InvalidOperationException("Modelo da arma ainda não carregado.");
        return node + Offsets.m_modelState + Offsets.m_MeshGroupMask;
    }

    internal int Apply(nint pawn, nint list, uint handle, ushort expectedWeapon, int paint, int seed, float wear, bool legacy)
    {
        if (TimedOut) throw new InvalidOperationException("Reinicie o CS2 após o tempo limite de materiais.");
        ResolveRegenerator(); // No weapon writes before compatibility validation.
        nint weapon = Entity(list, handle);
        if (weapon == 0) throw new InvalidOperationException("Equipe a arma selecionada.");
        nint item = weapon + Offsets.m_AttributeManager + Offsets.m_Item;
        if (Read<ushort>(item + Offsets.m_iItemDefinitionIndex) != expectedWeapon)
            throw new InvalidOperationException("Equipe a arma selecionada antes de aplicar.");
        nint hud = HudWeapon(pawn, list, weapon);
        if (hud == 0) throw new InvalidOperationException("Modelo em primeira pessoa indisponível. Equipe a arma e tente novamente.");
        var target = CaptureTarget(pawn, list, handle, 0);
        nint vector = item + Offsets.m_AttributeList + Offsets.m_Attributes;
        ulong originalCount = Read<ulong>(vector);
        nint originalPointer = Read<nint>(vector + 8);
        // Never replace/free engine-owned attributes (stickers, charms, inventory).
        if (originalCount != 0 || originalPointer != 0)
            throw new InvalidOperationException("Esta arma já possui atributos próprios. Teste com uma arma padrão, sem skin equipada.");

        byte[] attributes = SkinMaterialData.Attributes(paint, seed, wear);
        nint mesh = MeshAddress(weapon), hudMesh = MeshAddress(hud);
        nint worldNode = Read<nint>(weapon + Offsets.m_pGameSceneNode);
        nint hudNode = Read<nint>(hud + Offsets.m_pGameSceneNode);
        ulong previousMesh = Read<ulong>(mesh), previousHudMesh = Read<ulong>(hudMesh);
        int previousId = Read<int>(item + Offsets.m_iItemIDHigh);
        int previousPaint = Read<int>(weapon + Offsets.m_nFallbackPaintKit);
        int previousSeed = Read<int>(weapon + Offsets.m_nFallbackSeed);
        float previousWear = Read<float>(weapon + Offsets.m_flFallbackWear);
        nint allocation = VirtualAllocEx(process, 0, (nuint)attributes.Length, 0x3000, 0x04);
        if (allocation == 0) throw new Win32Exception(Marshal.GetLastWin32Error());
        nint call = 0;
        int materialCount = 0;
        bool completed = false;
        bool published = false;
        try
        {
            if (CaptureTarget(pawn, list, handle, 0) != target)
                throw new InvalidOperationException("Equipamento alterado antes da aplicação.");
            WriteBytes(allocation, attributes);
            Write(item + Offsets.m_iItemIDHigh, -1);
            Write(weapon + Offsets.m_nFallbackPaintKit, paint);
            Write(weapon + Offsets.m_nFallbackSeed, seed);
            Write(weapon + Offsets.m_flFallbackWear, wear);
            ulong mask = legacy ? 2UL : 1UL;
            Write(vector + 8, allocation);
            published = true;
            Write(vector, 3UL);
            // The console command skips stock weapons when both material vectors
            // are empty. Invoke its decoded clear/rebuild pair for THIS weapon,
            // with the same arguments, without patching the game's instructions.
            byte[] invoke = SkinMaterialData.ApplyCall(weapon, worldNode, hudNode, mask, meshSetter, regenerationPlan!);
            call = VirtualAllocEx(process, 0, (nuint)invoke.Length, 0x3000, 0x04);
            if (call == 0) throw new Win32Exception(Marshal.GetLastWin32Error());
            WriteBytes(call, invoke);
            if (!VirtualProtectEx(process, call, (nuint)invoke.Length, 0x20, out _) ||
                !FlushInstructionCache(process, call, (nuint)invoke.Length))
                throw new Win32Exception(Marshal.GetLastWin32Error(), "Não foi possível preparar a reconstrução de materiais.");
            if (CaptureTarget(pawn, list, handle, 0) != target)
                throw new InvalidOperationException("Equipamento alterado durante a preparação.");
            using SafeWaitHandle thread = CreateRemoteThread(process, 0, 0, call, 0, 0, out _);
            if (thread.IsInvalid) throw new Win32Exception(Marshal.GetLastWin32Error(), "Falha ao iniciar a atualização de materiais.");
            uint wait = WaitForSingleObject(thread, 10000);
            if (wait != 0)
            {
                // The game may still be consuming this vector. Do not free it.
                TimedOut = true;
                throw new InvalidOperationException("A atualização de materiais excedeu o tempo limite. Reinicie o CS2 antes de tentar novamente.");
            }
            if (!GetExitCodeThread(thread, out uint exit) || exit >= 0x80000000)
                throw new InvalidOperationException($"A rotina de materiais falhou (0x{exit:X8}).");
            DateTime deadline = DateTime.UtcNow.AddSeconds(2);
            do
            {
                int countA = Read<int>(weapon + regenerationPlan!.CountA);
                int countB = Read<int>(weapon + regenerationPlan.CountB);
                if (countA is < 0 or > 4096 || countB is < 0 or > 4096)
                    throw new InvalidOperationException("O jogo retornou uma lista de materiais inválida.");
                materialCount = countA + countB;
                if (materialCount > 0) break;
                Thread.Sleep(50);
            } while (DateTime.UtcNow < deadline);
            if (materialCount == 0)
                throw new InvalidOperationException("Skin não confirmada: o jogo não gerou materiais para a arma. Nenhum sucesso foi confirmado.");
            completed = true;
        }
        finally
        {
            if (!TimedOut)
            {
                if (call != 0) VirtualFreeEx(process, call, 0, 0x8000);
                // Restore only our vector, never a replacement published by the game.
                if (published && Read<nint>(vector + 8) == allocation)
                {
                    Write(vector, originalCount);
                    Write(vector + 8, originalPointer);
                }
                VirtualFreeEx(process, allocation, 0, 0x8000);
                if (!completed)
                {
                    Write(weapon + Offsets.m_nFallbackPaintKit, previousPaint);
                    Write(item + Offsets.m_iItemIDHigh, previousId);
                    Write(weapon + Offsets.m_nFallbackSeed, previousSeed);
                    Write(weapon + Offsets.m_flFallbackWear, previousWear);
                    Write(mesh, previousMesh);
                    Write(hudMesh, previousHudMesh);
                }
            }
        }
        return materialCount;
    }

    public void Dispose() => process.Dispose();

    [DllImport("kernel32.dll", SetLastError = true)] private static extern SafeProcessHandle OpenProcess(uint access, bool inherit, int pid);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool ReadProcessMemory(SafeProcessHandle process, nint address, byte[] buffer, nuint size, out nuint read);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool WriteProcessMemory(SafeProcessHandle process, nint address, byte[] buffer, nuint size, out nuint written);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern nint VirtualAllocEx(SafeProcessHandle process, nint address, nuint size, uint type, uint protection);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool VirtualFreeEx(SafeProcessHandle process, nint address, nuint size, uint type);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool VirtualProtectEx(SafeProcessHandle process, nint address, nuint size, uint protection, out uint previous);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool FlushInstructionCache(SafeProcessHandle process, nint address, nuint size);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern SafeWaitHandle CreateRemoteThread(SafeProcessHandle process, nint attributes, nuint stack, nint start, nint parameter, uint flags, out uint id);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern uint WaitForSingleObject(SafeWaitHandle handle, uint milliseconds);
    [DllImport("kernel32.dll", SetLastError = true)] private static extern bool GetExitCodeThread(SafeWaitHandle handle, out uint code);
}
