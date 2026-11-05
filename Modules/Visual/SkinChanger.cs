using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using ImGuiNET;
using Mac1ota_Menu.Data.Entity;
using Mac1ota_Menu.Data.Game;
using System.Numerics;

namespace Mac1ota_Menu.Modules.Visual
{
    // Visual catalogue inspired by ValorantTracker/cs2-skin-changer.
    // The native reference uses remote threads to rebuild materials; that
    // mechanism is not present here. Never describe a paint write as visually applied.
    internal static class SkinChanger
    {
        internal sealed record Skin(string Name, string Weapon, int PaintKit, string ImageUrl, string Rarity);
        private static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(16) };
        private static readonly (string Name, ushort Id)[] Weapons =
        {
            ("AK-47", 7), ("M4A4", 16), ("M4A1-S", 60), ("AWP", 9),
            ("Glock-18", 4), ("USP-S", 61), ("Desert Eagle", 1),
            ("P250", 36), ("FAMAS", 10), ("Galil AR", 13),
            ("SSG 08", 40), ("MP9", 34), ("MAC-10", 17),
            ("Five-SeveN", 3), ("Tec-9", 30), ("P90", 19)
        };

        private static readonly string CacheDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "legitbaratinho.xyz", "skin-images");
        private static readonly HashSet<string> PendingImages = new();
        private static readonly Dictionary<string, IntPtr> LoadedImages = new();
        private static readonly object ImageLock = new();
        private static List<Skin> _catalog = new();
        private static Task? _catalogTask;
        private static string _status = "Carregando catálogo de skins...";
        private static int _weaponIndex;
        private static int _selectedPaint;
        private static int _category;
        private static float _wear = 0.01f;
        private static int _seed;
        private static string _search = "";

        private static string GetString(JsonElement parent, string name)
        {
            if (!parent.TryGetProperty(name, out var value)) return "";
            if (value.ValueKind == JsonValueKind.String) return value.GetString() ?? "";
            if (value.ValueKind == JsonValueKind.Object &&
                value.TryGetProperty("name", out var nested) &&
                nested.ValueKind == JsonValueKind.String) return nested.GetString() ?? "";
            return "";
        }

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
                        JsonValueKind.Number when paint.TryGetInt32(out var n) => n,
                        JsonValueKind.String when int.TryParse(paint.GetString(), out var n) => n,
                        _ => 0
                    };
                    if (id <= 0) continue;
                    string name = GetString(entry, "name");
                    string weapon = GetString(entry, "weapon");
                    string image = GetString(entry, "image");
                    string rarity = GetString(entry, "rarity");
                    if (string.IsNullOrWhiteSpace(weapon) || string.IsNullOrWhiteSpace(name)) continue;
                    skins.Add(new Skin(name, weapon, id, image, rarity));
                }
                _catalog = skins.GroupBy(s => (s.Weapon, s.PaintKit))
                    .Select(group => group.First()).OrderBy(s => s.Name).ToList();
                _status = _catalog.Count > 0
                    ? $"Catálogo pronto: {_catalog.Count} skins disponíveis para seleção."
                    : "O catálogo não retornou skins.";
            }
            catch (Exception e)
            {
                _status = "Não foi possível carregar o catálogo: " + e.Message;
            }
        }

        private static string ImagePath(string url)
        {
            var hash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(url)));
            return Path.Combine(CacheDir, hash + ".png");
        }

        private static async Task DownloadImageAsync(string url, string path)
        {
            try
            {
                if (!Uri.TryCreate(url, UriKind.Absolute, out var uri) || uri.Scheme != Uri.UriSchemeHttps)
                    return;
                Directory.CreateDirectory(CacheDir);
                using var response = await Http.GetAsync(uri, HttpCompletionOption.ResponseHeadersRead);
                response.EnsureSuccessStatusCode();
                if (response.Content.Headers.ContentLength > 2_000_000) return;
                await using var stream = await response.Content.ReadAsStreamAsync();
                using var memory = new MemoryStream();
                await stream.CopyToAsync(memory);
                if (memory.Length > 2_000_000) return;
                // ImageSharp checks format before GPU upload; write only validated PNG data.
                using var decoded = SixLabors.ImageSharp.Image.Load(memory.ToArray());
                if (decoded.Width > 1024 || decoded.Height > 1024) return;
                await decoded.SaveAsPngAsync(path);
            }
            catch { /* optional thumbnail; keep text-based selection usable */ }
            finally
            {
                lock (ImageLock) PendingImages.Remove(url);
            }
        }

        private static void Thumbnail(Skin skin, Vector2 size)
        {
            if (string.IsNullOrWhiteSpace(skin.ImageUrl))
            {
                ImGui.Dummy(size);
                return;
            }
            var path = ImagePath(skin.ImageUrl);
            if (!File.Exists(path))
            {
                lock (ImageLock)
                {
                    // Bound simultaneous fetches to avoid flooding the image service.
                    if (PendingImages.Count < 6 && PendingImages.Add(skin.ImageUrl))
                        _ = Task.Run(() => DownloadImageAsync(skin.ImageUrl, path));
                }
                ImGui.Dummy(size);
                return;
            }
            if (!LoadedImages.TryGetValue(path, out var ptr))
            {
                try
                {
                    if (GameState.renderer == null) { ImGui.Dummy(size); return; }
                    GameState.renderer.AddOrGetImagePointer(path, false, out ptr, out _, out _);
                    LoadedImages[path] = ptr;
                }
                catch { ImGui.Dummy(size); return; }
            }
            ImGui.Image(ptr, size);
        }

        private static void SkinCard(Skin skin, int index, float width)
        {
            bool selected = skin.PaintKit == _selectedPaint;
            ImGui.PushID(index);
            var bg = selected ? new Vector4(.10f, .22f, .20f, 1f) : new Vector4(.075f, .10f, .115f, 1f);
            ImGui.PushStyleColor(ImGuiCol.ChildBg, bg);
            ImGui.PushStyleVar(ImGuiStyleVar.ChildRounding, 9f);
            ImGui.BeginChild("skinCard", new Vector2(width, 177f), ImGuiChildFlags.Borders);
            {
                Thumbnail(skin, new Vector2(Math.Max(1, width - 18), 107));
                ImGui.TextWrapped(skin.Name.Length > 24 ? skin.Name[..24] + "…" : skin.Name);
                ImGui.TextDisabled("Paint kit #" + skin.PaintKit);
                if (ImGui.Selectable(selected ? "Selecionada##choose" : "Selecionar##choose", selected))
                    _selectedPaint = skin.PaintKit;
            }
            ImGui.EndChild();
            ImGui.PopStyleVar();
            ImGui.PopStyleColor();
            ImGui.PopID();
        }

        public static void Render()
        {
            _catalogTask ??= Task.Run(LoadCatalogAsync);
            ImGui.TextColored(new Vector4(.25f, .88f, .68f, 1f), "SKIN CHANGER");
            ImGui.SameLine();
            ImGui.TextDisabled("   /   legitbaratinho.xyz");
            ImGui.Separator();
            ImGui.Spacing();

            if (ImGui.Button("Armas", new Vector2(110, 32))) _category = 0;
            ImGui.SameLine();
            if (ImGui.Button("Facas", new Vector2(95, 32))) _category = 1;
            ImGui.SameLine();
            if (ImGui.Button("Luvas", new Vector2(95, 32))) _category = 2;
            ImGui.SameLine();
            if (ImGui.Button("Kits musicais", new Vector2(125, 32))) _category = 3;
            ImGui.Spacing();

            if (_category != 0)
            {
                ImGui.TextWrapped("Essa categoria ainda não dispõe de aplicação no CS2 nesta versão.");
                ImGui.TextDisabled("A seleção de armas é a única função experimental disponível.");
                return;
            }

            ImGui.PushItemWidth(245);
            if (ImGui.BeginCombo("Arma", Weapons[_weaponIndex].Name))
            {
                for (int i = 0; i < Weapons.Length; i++)
                    if (ImGui.Selectable(Weapons[i].Name, i == _weaponIndex))
                    {
                        _weaponIndex = i;
                        _selectedPaint = 0;
                    }
                ImGui.EndCombo();
            }
            ImGui.PopItemWidth();
            ImGui.SameLine();
            ImGui.PushItemWidth(210);
            ImGui.InputText("Pesquisar", ref _search, 96);
            ImGui.PopItemWidth();
            ImGui.TextDisabled(_status);

            var available = _catalog.Where(s =>
                s.Weapon.Equals(Weapons[_weaponIndex].Name, StringComparison.OrdinalIgnoreCase) &&
                s.Name.Contains(_search, StringComparison.OrdinalIgnoreCase)).ToArray();

            ImGui.BeginChild("skinGrid", new Vector2(0, -156f), ImGuiChildFlags.None);
            {
                float space = ImGui.GetContentRegionAvail().X;
                const float gap = 10f;
                int cols = Math.Max(1, (int)((space + gap) / (174f + gap)));
                float width = Math.Max(150f, (space - (cols - 1) * gap) / cols - 2f);
                for (int i = 0; i < available.Length; i++)
                {
                    if (i % cols != 0) ImGui.SameLine(0, gap);
                    SkinCard(available[i], i, width);
                }
                if (available.Length == 0) ImGui.TextDisabled("Nenhuma skin encontrada para esta arma.");
            }
            ImGui.EndChild();

            ImGui.Separator();
            ImGui.PushItemWidth(155);
            ImGui.SliderFloat("Desgaste", ref _wear, .0001f, 1f, "%.4f");
            ImGui.SameLine();
            ImGui.InputInt("Seed", ref _seed);
            _seed = Math.Clamp(_seed, 0, 1000);
            ImGui.PopItemWidth();

            if (ImGui.Button("Testar atributos na arma equipada", new Vector2(265, 34)))
            {
                var selected = available.FirstOrDefault(s => s.PaintKit == _selectedPaint);
                if (selected == null) _status = "Escolha uma skin primeiro.";
                else ApplyToEquippedWeapon(Weapons[_weaponIndex].Id, selected.PaintKit);
            }
            ImGui.SameLine();
            if (ImGui.Button("Recarregar lista") && _catalogTask?.IsCompleted == true)
                _catalogTask = Task.Run(LoadCatalogAsync);
            ImGui.TextWrapped("Teste experimental. O jogo pode não reconstruir o visual sem regeneração dos materiais.");
        }

        private static void ApplyToEquippedWeapon(ushort expectedWeapon, int paintKit)
        {
            try
            {
                var mem = GameState.memory;
                if (mem == null || GameState.client == IntPtr.Zero || !GameState.IsConnectedToCS2())
                { _status = "Conecte-se ao CS2."; return; }
                if (Offsets.dwLocalPlayerPawn <= 0 || Offsets.dwEntityList <= 0 ||
                    Offsets.m_pWeaponServices <= 0 || Offsets.m_hActiveWeapon <= 0 ||
                    Offsets.m_AttributeManager <= 0 || Offsets.m_Item <= 0 ||
                    Offsets.m_iItemDefinitionIndex <= 0 || Offsets.m_iItemIDHigh <= 0 ||
                    Offsets.m_nFallbackPaintKit <= 0 || Offsets.m_flFallbackWear <= 0 ||
                    Offsets.m_nFallbackSeed <= 0)
                { _status = "Offsets de skin indisponíveis."; return; }

                var pawn = mem.ReadPointer(GameState.client + Offsets.dwLocalPlayerPawn);
                if (pawn == IntPtr.Zero) { _status = "Pawn local indisponível."; return; }
                var services = mem.ReadPointer(pawn + Offsets.m_pWeaponServices);
                if (services == IntPtr.Zero) { _status = "Serviço de armas indisponível."; return; }
                var handle = mem.ReadUInt(services + Offsets.m_hActiveWeapon);
                var list = mem.ReadPointer(GameState.client + Offsets.dwEntityList);
                if (list == IntPtr.Zero || handle == 0 || handle == uint.MaxValue)
                { _status = "Arma ativa indisponível."; return; }
                var weapon = EntityManager.GetPlayerPawn(list, (nint)handle);
                if (weapon == IntPtr.Zero) { _status = "Handle da arma inválido."; return; }
                var item = weapon + Offsets.m_AttributeManager + Offsets.m_Item;
                var definition = mem.Read<ushort>(item + Offsets.m_iItemDefinitionIndex);
                if (definition != expectedWeapon)
                { _status = "Equipe a arma selecionada antes de testar."; return; }

                mem.Write<int>(item + Offsets.m_iItemIDHigh, -1);
                mem.Write<int>(weapon + Offsets.m_nFallbackPaintKit, paintKit);
                mem.Write<int>(weapon + Offsets.m_nFallbackSeed, _seed);
                mem.Write<float>(weapon + Offsets.m_flFallbackWear, Math.Clamp(_wear, .0001f, 1f));

                int actualPaint = mem.ReadInt(weapon + Offsets.m_nFallbackPaintKit);
                int actualSeed = mem.ReadInt(weapon + Offsets.m_nFallbackSeed);
                float actualWear = mem.ReadFloat(weapon + Offsets.m_flFallbackWear);
                if (actualPaint != paintKit || actualSeed != _seed ||
                    !float.IsFinite(actualWear) || Math.Abs(actualWear - _wear) > .001f)
                { _status = "Falha: leitura dos atributos diferente do valor enviado."; return; }

                _status = $"Paint kit {paintKit} confirmado na leitura da memória. Renderização da skin NÃO confirmada.";
            }
            catch (Exception e)
            {
                _status = "Falha ao testar atributos: " + e.Message;
            }
        }
    }
}
