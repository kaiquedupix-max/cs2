using System.Drawing;
using System.Windows.Forms;
using Mac1ota_Menu.Modules.Visual;
namespace Mac1ota_Menu.Classes;
internal sealed class CosmeticLoadoutForm : Form
{
    readonly ComboBox category = new() { DropDownStyle = ComboBoxStyle.DropDownList, Width = 130 };
    readonly ComboBox model = new() { DropDownStyle = ComboBoxStyle.DropDownList, Width = 270, DisplayMember = "Name" };
    readonly ComboBox profile = new() { Width = 240 };
    readonly TextBox search = new() { PlaceholderText = "Pesquisar skin", Width = 320 };
    readonly ListBox skins = new() { DisplayMember = "Name", Size = new Size(740, 220) };
    readonly ListBox selected = new() { DisplayMember = "Name", Size = new Size(740, 100) };
    readonly NumericUpDown wear = new() { DecimalPlaces = 4, Increment = .001m, Maximum = 1, Value = .01m };
    readonly NumericUpDown seed = new() { Maximum = 1000 };
    readonly CheckBox stat = new() { Text = "StatTrak", AutoSize = true };
    readonly NumericUpDown counter = new() { Maximum = int.MaxValue };
    readonly CheckBox automatic = new() { Text = "Aplicar ao equipar", AutoSize = true };
    readonly Label status = new() { AutoSize = true, MaximumSize = new Size(740, 0) };
    IReadOnlyList<SkinChanger.Skin> catalog = Array.Empty<SkinChanger.Skin>();
    sealed record Model(ushort Id, string Name);
    internal CosmeticLoadoutForm()
    {
        Text = "Skins e configurações"; ClientSize = new Size(790, 675);
        StartPosition = FormStartPosition.CenterParent; FormBorderStyle = FormBorderStyle.FixedDialog;
        MaximizeBox = false; Font = new Font("Segoe UI", 10);
        var layout = new FlowLayoutPanel { Dock = DockStyle.Fill, Padding = new Padding(16), FlowDirection = FlowDirection.TopDown, WrapContents = false, AutoScroll = true };
        Controls.Add(layout);
        void Row(params Control[] controls) { var row = new FlowLayoutPanel { AutoSize = true, Width = 750, WrapContents = false }; row.Controls.AddRange(controls); layout.Controls.Add(row); }
        Button ActionButton(string text, Action action) {
            var b = new Button { Text = text, AutoSize = true, Height = 34 };
            b.Click += (_, _) => { try { action(); } catch (Exception ex) { status.Text = ex.Message; } }; return b;
        }
        Row(profile, ActionButton("Carregar config", () => {
            string name = ProfileName();
            if (!File.Exists(Path.Combine(Configs.ConfigDirPath, name + ".json"))) throw new InvalidOperationException("Configuração não encontrada.");
            Configs.LoadConfig(name); RefreshChoices(); Restore();
            status.Text = "Config carregada. " + (Modules.Combat.Rage.Enabled ? "Rage ativo: risco de banimento. Não nos responsabilizamos por banimentos." : "Aguardando o jogo.");
        }), ActionButton("Salvar config", () => {
            Directory.CreateDirectory(Configs.ConfigDirPath); Configs.SaveConfig(ProfileName()); RefreshProfiles(); status.Text = "Config salva com as escolhas de skins.";
        }));
        category.Items.AddRange(new object[] { "Armas", "Facas", "Luvas" }); category.SelectedIndex = 0;
        Row(category, model, search); Row(skins);
        Row(new Label { Text = "Desgaste", AutoSize = true }, wear, new Label { Text = "Seed", AutoSize = true }, seed, stat, counter);
        Row(ActionButton("Preparar seleção", () => {
            if (skins.SelectedItem is not SkinChanger.Skin skin) throw new InvalidOperationException("Selecione uma skin.");
            SkinChangerService.Select(skin.Definition, skin.PaintKit, (int)seed.Value, (float)wear.Value, skin.Legacy,
                skin.Name, CosmeticModels.Rarity(skin.Rarity), skin.Category, stat.Checked && skin.SupportsStatTrak, (int)counter.Value);
            RefreshChoices(); status.Text = "Escolha preparada. Salve a config para outra sessão.";
        }), automatic);
        Row(new Label { Text = "Escolhas preparadas", AutoSize = true }); Row(selected);
        Row(ActionButton("Remover escolha", () => { if (selected.SelectedItem is CosmeticLoadout.Choice c) { CosmeticLoadout.Remove(c); RefreshChoices(); } })); Row(status);
        category.SelectedIndexChanged += (_, _) => RefreshModels();
        model.SelectedIndexChanged += (_, _) => { Filter(); Restore(); };
        search.TextChanged += (_, _) => Filter();
        skins.SelectedIndexChanged += (_, _) => {
            if (skins.SelectedItem is not SkinChanger.Skin s) return;
            wear.Minimum = 0; wear.Maximum = 1;
            wear.Value = System.Math.Clamp(wear.Value, (decimal)s.MinWear, (decimal)s.MaxWear);
            wear.Minimum = (decimal)s.MinWear; wear.Maximum = (decimal)s.MaxWear;
            stat.Enabled = s.SupportsStatTrak && s.Category != 2;
            if (!stat.Enabled) stat.Checked = false;
        };
        automatic.CheckedChanged += (_, _) => CosmeticLoadout.Automatic = automatic.Checked;
        Shown += async (_, _) => {
            RefreshProfiles(); RefreshChoices(); status.Text = "Carregando catálogo...";
            try { var loaded = await SkinChanger.GetCatalogAsync(); if (IsDisposed) return; catalog = loaded; RefreshModels(); status.Text = "Prepare as skins mesmo com o CS2 fechado."; }
            catch (Exception ex) { if (!IsDisposed) status.Text = ex.Message; }
        };
    }
    string ProfileName() {
        string name = profile.Text.Trim(); if (name.EndsWith(".json", StringComparison.OrdinalIgnoreCase)) name = name[..^5];
        if (name.Length == 0 || name is "." or ".." || name.IndexOfAny(Path.GetInvalidFileNameChars()) >= 0) throw new InvalidOperationException("Informe um nome válido para a configuração.");
        return name;
    }
    void RefreshProfiles() {
        string current = profile.Text; profile.Items.Clear();
        if (Directory.Exists(Configs.ConfigDirPath)) profile.Items.AddRange(Directory.GetFiles(Configs.ConfigDirPath, "*.json").Select(p => (object)Path.GetFileNameWithoutExtension(p)).ToArray());
        profile.Text = current;
    }
    void RefreshChoices() { selected.DataSource = null; selected.DataSource = (CosmeticLoadout.Choices ?? new()).ToList(); automatic.Checked = CosmeticLoadout.Automatic; }
    void RefreshModels() { model.DataSource = catalog.Where(s => s.Category == category.SelectedIndex).Select(s => new Model(s.Definition, s.Weapon)).Distinct().OrderBy(s => s.Name).ToList(); }
    void Filter() { skins.DataSource = model.SelectedItem is Model m ? catalog.Where(s => s.Category == category.SelectedIndex && s.Definition == m.Id && s.Name.Contains(search.Text, StringComparison.OrdinalIgnoreCase)).ToList() : null; }
    void Restore() {
        if (model.SelectedItem is not Model m) return;
        var c = CosmeticLoadout.Find(category.SelectedIndex, m.Id); if (c == null) return;
        for (int i = 0; i < skins.Items.Count; i++) if (((SkinChanger.Skin)skins.Items[i]).PaintKit == c.Paint) { skins.SelectedIndex = i; break; }
        wear.Value = System.Math.Clamp((decimal)c.Wear, wear.Minimum, wear.Maximum); seed.Value = System.Math.Clamp(c.Seed, 0, 1000);
        stat.Checked = stat.Enabled && c.StatTrak; counter.Value = System.Math.Max(0, c.Counter);
    }
}

