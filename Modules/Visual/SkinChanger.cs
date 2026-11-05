using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using Mac1ota_Menu.Data.Entity;
using Mac1ota_Menu.Data.Game;
using ImGuiNET;

namespace Mac1ota_Menu.Modules.Visual
{
    // Independent C# implementation inspired by the selection model in Nou4r/cs2-skin-changer.
    // The original C++ project uses remote execution to regenerate materials; this module
    // deliberately does not copy those version-sensitive patching/injection routines.
    internal static class SkinChanger
    {
        internal sealed record Skin(string Name, string Weapon, int PaintKit);
        private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(15) };
        private static readonly (string Name, ushort Id)[] Weapons =
        {
            ("AK-47", 7), ("M4A4", 16), ("M4A1-S", 60), ("AWP", 9),
            ("Glock-18", 4), ("USP-S", 61), ("Desert Eagle", 1),
            ("P250", 36), ("FAMAS", 10), ("Galil AR", 13),
            ("SSG 08", 40), ("MP9", 34), ("MAC-10", 17),
            ("Five-SeveN", 3), ("Tec-9", 30), ("P90", 19)
        };
        private static List<Skin> _catalog = new();
        private static Task? _catalogTask;
        private static string _status = "Catálogo ainda não carregado.";
        private static int _weaponIndex;
        private static int _skinIndex;
        private static float _wear = 0.01f;
        private static int _seed;
        private static string _search = "";

        private static async Task LoadCatalogAsync()
        {
            try
            {
                const string url = "https://raw.githubusercontent.com/ByMykel/CSGO-API/main/public/api/en/skins.json";
                using var response = await Http.GetAsync(url);
                response.EnsureSuccessStatusCode();
                await using var stream = await response.Content.ReadAsStreamAsync();
                using var doc = await JsonDocument.ParseAsync(stream);
                var skins = new List<Skin>();
                foreach (var entry in doc.RootElement.EnumerateArray())
                {
                    if (!entry.TryGetProperty("paint_index", out var paint)) continue;
                    int id = paint.ValueKind switch
                    {
                        JsonValueKind.Number when paint.TryGetInt32(out int n) => n,
                        JsonValueKind.String when int.TryParse(paint.GetString(), out int n) => n,
                        _ => 0
                    };
                    if (id <= 0 || !entry.TryGetProperty("name", out var nameProp)) continue;
                    var name = nameProp.GetString() ?? "";
                    if (!entry.TryGetProperty("weapon", out var weaponProp)) continue;
                    var weapon = weaponProp.ValueKind == JsonValueKind.Object &&
                                 weaponProp.TryGetProperty("name", out var weaponName)
                        ? weaponName.GetString() ?? "" : "";
                    if (string.IsNullOrWhiteSpace(weapon) || string.IsNullOrWhiteSpace(name)) continue;
                    skins.Add(new Skin(name, weapon, id));
                }
                _catalog = skins.GroupBy(s => (s.Weapon, s.PaintKit))
                    .Select(g => g.First()).OrderBy(s => s.Name).ToList();
                _status = _catalog.Count == 0
                    ? "O catálogo remoto não retornou skins compatíveis."
                    : $"Catálogo carregado: {_catalog.Count} skins.";
            }
            catch (Exception e)
            {
                _status = "Falha ao carregar catálogo: " + e.Message;
            }
        }

        public static void Render()
        {
            _catalogTask ??= Task.Run(LoadCatalogAsync);
            ImGui.TextWrapped("Escolha uma arma, selecione uma skin e equipe essa arma no CS2 antes de aplicar.");
            ImGui.TextDisabled(_status);
            if (ImGui.Button("Recarregar catálogo") && _catalogTask.IsCompleted)
                _catalogTask = Task.Run(LoadCatalogAsync);

            if (ImGui.BeginCombo("Arma", Weapons[_weaponIndex].Name))
            {
                for (var i = 0; i < Weapons.Length; i++)
                {
                    if (ImGui.Selectable(Weapons[i].Name, i == _weaponIndex))
                    { _weaponIndex = i; _skinIndex = 0; }
                }
                ImGui.EndCombo();
            }

            ImGui.InputText("Pesquisar skin", ref _search, 96);
            var available = _catalog.Where(s =>
                s.Weapon.Equals(Weapons[_weaponIndex].Name, StringComparison.OrdinalIgnoreCase) &&
                s.Name.Contains(_search, StringComparison.OrdinalIgnoreCase)).ToArray();
            _skinIndex = Math.Clamp(_skinIndex, 0, Math.Max(0, available.Length - 1));
            var preview = available.Length > 0 ? available[_skinIndex].Name : "Nenhuma skin encontrada";
            if (ImGui.BeginCombo("Skin", preview))
            {
                for (var i = 0; i < available.Length; i++)
                    if (ImGui.Selectable(available[i].Name + "##" + i, i == _skinIndex))
                        _skinIndex = i;
                ImGui.EndCombo();
            }
            ImGui.SliderFloat("Desgaste (wear)", ref _wear, 0.0001f, 1f, "%.4f");
            ImGui.InputInt("Seed", ref _seed);
            _seed = Math.Clamp(_seed, 0, 1000);
            if (available.Length > 0 && ImGui.Button("Aplicar na arma equipada"))
                ApplyToEquippedWeapon(Weapons[_weaponIndex].Id, available[_skinIndex].PaintKit);
            ImGui.Separator();
            ImGui.TextWrapped("Experimental: escreve somente atributos de pintura, seed e desgaste da arma equipada. O visual pode não atualizar sem regeneração de materiais no jogo.");
            ImGui.TextDisabled("Não altera o inventário Steam e não adiciona skins à sua conta.");
        }

        private static void ApplyToEquippedWeapon(ushort expectedWeapon, int paintKit)
        {
            try
            {
                var mem = GameState.memory;
                if (mem == null || GameState.client == IntPtr.Zero || !GameState.IsConnectedToCS2())
                { _status = "Conecte-se ao CS2 antes de aplicar."; return; }
                if (Offsets.dwLocalPlayerPawn <= 0 || Offsets.dwEntityList <= 0 ||
                    Offsets.m_pWeaponServices <= 0 || Offsets.m_hActiveWeapon <= 0 ||
                    Offsets.m_AttributeManager <= 0 || Offsets.m_Item <= 0 ||
                    Offsets.m_iItemDefinitionIndex <= 0 || Offsets.m_iItemIDHigh <= 0 ||
                    Offsets.m_nFallbackPaintKit <= 0 || Offsets.m_flFallbackWear <= 0 ||
                    Offsets.m_nFallbackSeed <= 0)
                { _status = "Offsets necessários ausentes ou desatualizados."; return; }

                var pawn = mem.ReadPointer(GameState.client + Offsets.dwLocalPlayerPawn);
                if (pawn == IntPtr.Zero) { _status = "Jogador local indisponível."; return; }
                var services = mem.ReadPointer(pawn + Offsets.m_pWeaponServices);
                if (services == IntPtr.Zero) { _status = "Serviço de armas indisponível."; return; }
                var handle = mem.ReadUInt(services + Offsets.m_hActiveWeapon);
                var list = mem.ReadPointer(GameState.client + Offsets.dwEntityList);
                if (list == IntPtr.Zero || handle == 0 || handle == uint.MaxValue)
                { _status = "Arma ativa não encontrada."; return; }
                var weapon = EntityManager.GetPlayerPawn(list, (nint)handle);
                if (weapon == IntPtr.Zero) { _status = "Não foi possível resolver a arma."; return; }
                var item = weapon + Offsets.m_AttributeManager + Offsets.m_Item;
                var definition = mem.Read<ushort>(item + Offsets.m_iItemDefinitionIndex);
                if (definition != expectedWeapon)
                { _status = "Equipe a arma selecionada antes de aplicar."; return; }

                mem.Write<int>(item + Offsets.m_iItemIDHigh, -1);
                mem.Write<int>(weapon + Offsets.m_nFallbackPaintKit, paintKit);
                mem.Write<int>(weapon + Offsets.m_nFallbackSeed, _seed);
                mem.Write<float>(weapon + Offsets.m_flFallbackWear, Math.Clamp(_wear, 0.0001f, 1f));
                _status = $"Atributos enviados (paint kit {paintKit}). Aparência não confirmada.";
            }
            catch (Exception e)
            {
                _status = "Falha ao aplicar atributos: " + e.Message;
            }
        }
    }
}
