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
