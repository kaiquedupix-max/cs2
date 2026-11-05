using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using ImGuiNET;
using Mac1ota_Menu.Classes;
using Mac1ota_Menu.Data.Game;
using System.Numerics;
using SixLabors.ImageSharp;

namespace Mac1ota_Menu.Modules.Visual
{
    // Catalogue + material regeneration through SkinChangerService.
    internal static class SkinChanger
    {
        internal sealed record Skin(string Name, string Weapon, ushort Definition, int Category, int PaintKit, string ImageUrl, string Rarity, bool Legacy, float MinWear, float MaxWear, bool SupportsStatTrak);
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
        private static bool _statTrak;
        private static int _counter;
        private static List<CosmeticLoadout.Choice>? _lastChoices;
        private static string _search = "";

        internal static async Task<IReadOnlyList<Skin>> GetCatalogAsync()
        {
            _catalogTask ??= Task.Run(LoadCatalogAsync);
            await _catalogTask;
            if (_catalog.Count == 0) throw new InvalidOperationException(_status);
            return _catalog;
        }

        private static void RestoreChoice(ushort definition)
        {
            var choice = CosmeticLoadout.Find(_category, definition);
            if (choice == null) return;
            _selectedPaint = choice.Paint; _seed = choice.Seed; _wear = choice.Wear;
            _statTrak = choice.StatTrak; _counter = choice.Counter;
        }

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
                    if (!entry.TryGetProperty("weapon", out var weaponData) ||
                        !weaponData.TryGetProperty("weapon_id", out var definitionData) || !definitionData.TryGetUInt16(out ushort definition)) continue;
                    string categoryName = GetString(entry, "category");
                    int category = categoryName == "Gloves" ? 2 : CosmeticModels.IsKnife(definition) ? 1 : 0;
                    string translated = CosmeticModels.ModelLabel(definition, weapon);
                    if (translated != weapon) { name = name.Replace(weapon, translated, StringComparison.Ordinal); weapon = translated; }
                    if (string.IsNullOrWhiteSpace(weapon) || string.IsNullOrWhiteSpace(name)) continue;
                    bool legacy = entry.TryGetProperty("legacy_model", out var model) && model.ValueKind == JsonValueKind.True;
                    float min = entry.TryGetProperty("min_float", out var minFloat) && minFloat.ValueKind == JsonValueKind.Number && minFloat.TryGetSingle(out var minValue) ? minValue : 0f;
                    float max = entry.TryGetProperty("max_float", out var maxFloat) && maxFloat.ValueKind == JsonValueKind.Number && maxFloat.TryGetSingle(out var maxValue) ? maxValue : 1f;
                    bool statTrak = entry.TryGetProperty("stattrak", out var st) && st.ValueKind == JsonValueKind.True;
                    skins.Add(new Skin(name, weapon, definition, category, id, image, rarity, legacy, min, max, statTrak));
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
                { _selectedPaint = skin.PaintKit; if (!skin.SupportsStatTrak) _statTrak = false; }
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

            void Category(int value) { if (_category != value) { _category = value; _lastChoices = null; _weaponIndex = 0; _selectedPaint = 0; _search = ""; } }
            if (ImGui.Button("Armas", new Vector2(110, 32))) Category(0);
            ImGui.SameLine();
            if (ImGui.Button("Facas", new Vector2(95, 32))) Category(1);
            ImGui.SameLine();
            if (ImGui.Button("Luvas", new Vector2(95, 32))) Category(2);
            ImGui.Spacing();

            var models = _category == 0 ? Weapons : _catalog.Where(s => s.Category == _category)
                .Select(s => (Name: s.Weapon, Id: s.Definition)).Distinct().OrderBy(m => m.Name).ToArray();
            if (models.Length == 0)
            {
                ImGui.TextWrapped(_status);
                return;
            }
            _weaponIndex = Math.Clamp(_weaponIndex, 0, models.Length - 1);
            if (!ReferenceEquals(_lastChoices, CosmeticLoadout.Choices))
            { _lastChoices = CosmeticLoadout.Choices; RestoreChoice(models[_weaponIndex].Id); }

            ImGui.PushItemWidth(245);
            if (ImGui.BeginCombo(_category == 0 ? "Arma" : "Modelo", models[_weaponIndex].Name))
            {
                for (int i = 0; i < models.Length; i++)
                    if (ImGui.Selectable(models[i].Name, i == _weaponIndex))
                    {
                        _weaponIndex = i;
                        _selectedPaint = 0;
                        _statTrak = false; _counter = 0;
                        RestoreChoice(models[i].Id);
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
                s.Category == _category && s.Definition == models[_weaponIndex].Id &&
                s.Name.Contains(_search, StringComparison.OrdinalIgnoreCase)).ToArray();

            ImGui.BeginChild("skinGrid", new Vector2(0, -184f), ImGuiChildFlags.None);
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

            var chosen = available.FirstOrDefault(s => s.PaintKit == _selectedPaint);
            bool supportsStatTrak = chosen?.SupportsStatTrak == true && _category != 2;
            if (!supportsStatTrak) _statTrak = false;
            ImGui.BeginDisabled(!supportsStatTrak);
            ImGui.Checkbox("StatTrak", ref _statTrak);
            if (_statTrak) { ImGui.SameLine(); ImGui.SetNextItemWidth(130); ImGui.InputInt("Contador", ref _counter); _counter = Math.Max(0, _counter); }
            ImGui.EndDisabled();

            if (ImGui.Button("Aplicar skin", new Vector2(265, 34)))
            {
                var selected = available.FirstOrDefault(s => s.PaintKit == _selectedPaint);
                if (selected == null) _status = "Escolha uma skin primeiro.";
                else
                {
                    try
                    {
                        _wear = Math.Clamp(_wear, selected.MinWear, selected.MaxWear);
                        SkinChangerService.Select(selected.Definition, selected.PaintKit, _seed, _wear, selected.Legacy,
                            selected.Name, CosmeticModels.Rarity(selected.Rarity), selected.Category, _statTrak, _counter);
                    }
                    catch (Exception ex) { _status = ex.Message; }
                }
            }
            ImGui.SameLine();
            if (ImGui.Button("Recarregar lista") && _catalogTask?.IsCompleted == true)
                _catalogTask = Task.Run(LoadCatalogAsync);
            bool enabled = SkinChangerService.Enabled;
            if (ImGui.Checkbox("Aplicar escolhas automaticamente ao equipar", ref enabled)) SkinChangerService.Enabled = enabled;
            ImGui.TextWrapped(SkinChangerService.Status);
        }

    }
}

