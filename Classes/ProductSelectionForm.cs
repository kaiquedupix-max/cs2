using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace Mac1ota_Menu.Classes
{
    internal sealed class ProductSelectionForm : Form
    {
        private static readonly Color Bg =
            Color.FromArgb(10, 5, 11);

        private static readonly Color PanelBg =
            Color.FromArgb(21, 10, 22);

        private static readonly Color Accent =
            Color.FromArgb(149, 85, 240);

        private static readonly Color TextPrimary =
            Color.FromArgb(243, 239, 244);

        private static readonly Color TextSecondary =
            Color.FromArgb(147, 126, 148);

        private readonly LoaderBackgroundCanvas _background =
            new();

        private readonly RoundedPanel _panel =
            new();

        private readonly Label _username =
            new();

        private readonly Label _email =
            new();

        private readonly Label _plan =
            new();

        private readonly Label _days =
            new();

        private readonly Label _expires =
            new();

        private readonly Label _status =
            new();

        private readonly Label _statusMessage =
            new();

        private readonly Label _access =
            new();

        private readonly GlowButton _start =
            new();

        private readonly Button _buy =
            new();

        private readonly Button _refresh =
            new();

        private bool _refreshing;

        private readonly Panel _chipHost =
            new();

        private Label? _icon;

        private Label? _productName;

        private Label? _category;

        private ClientPortalApi.AccountSnapshot? _account;

        private string _selected =
            "";

        private const string CombatArmsCode =
            "combatarms";

        public ProductSelectionForm()
        {
            SuspendLayout();

            Text =
                "legitbaratinho.xyz";

            ClientSize =
                new Size(
                    1300,
                    825);

            StartPosition =
                FormStartPosition.CenterScreen;

            FormBorderStyle =
                FormBorderStyle.None;

            BackColor =
                Bg;

            BuildBackground();
            BuildHeader();
            BuildProductPanel();
            BuildWindowButtons();

            Shown +=
                async (_, _) =>
                {
                    ApplyRoundedRegion();

                    await RefreshAccountAsync();
                    ShowDisplayNotice();
                };

            Resize +=
                (_, _) =>
                    ApplyRoundedRegion();

            ResumeLayout(
                false);
        }

        private void BuildBackground()
        {
            _background.Dock =
                DockStyle.Fill;

            _background.Artwork =
                EmbeddedAssets.LoadBitmap(
                    "LoaderBackground.png");

            Controls.Add(
                _background);

            _background.SendToBack();
        }

        private void BuildHeader()
        {
            var logo =
                new BrandIconControl
                {
                    Parent =
                        _background,

                    Location =
                        new Point(
                            23,
                            17),

                    Size =
                        new Size(
                            42,
                            42)
                };

            var name =
                MakeLabel(
                    "legitbaratinho.xyz",
                    11f,
                    FontStyle.Bold,
                    TextPrimary,
                    77,
                    28);

            name.Parent =
                _background;

            var eyebrow =
                MakeLabel(
                    "CONTA CONECTADA",
                    8f,
                    FontStyle.Bold,
                    Accent,
                    62,
                    140);

            eyebrow.Parent =
                _background;

            _username.Parent =
                _background;

            _username.Font =
                FontOf(
                    31f,
                    FontStyle.Bold);

            _username.ForeColor =
                TextPrimary;

            _username.BackColor =
                Color.Transparent;

            _username.AutoSize =
                true;

            _username.Location =
                new Point(
                    60,
                    170);

            _email.Parent =
                _background;

            _email.Font =
                FontOf(
                    10f,
                    FontStyle.Regular);

            _email.ForeColor =
                TextSecondary;

            _email.BackColor =
                Color.Transparent;

            _email.AutoSize =
                true;

            _email.Location =
                new Point(
                    64,
                    220);

            var profileCard =
                new RoundedPanel
                {
                    Parent =
                        _background,

                    Location =
                        new Point(
                            60,
                            300),

                    Size =
                        new Size(
                            500,
                            214),

                    Radius =
                        18,

                    FillColor =
                        Color.FromArgb(15, 8, 17),

                    BorderColor =
                        Color.FromArgb(50, 27, 57)
                };

            AddMetric(
                profileCard,
                "PLANO",
                _plan,
                24);

            AddMetric(
                profileCard,
                "DIAS RESTANTES",
                _days,
                88);

            AddMetric(
                profileCard,
                "EXPIRA EM",
                _expires,
                152);

            var hint =
                MakeLabel(
                    "O mesmo login do site é usado neste loader.",
                    8f,
                    FontStyle.Regular,
                    TextSecondary,
                    65,
                    545);

            hint.Parent =
                _background;
        }

        private void BuildProductPanel()
        {
            _panel.Parent =
                _background;

            _panel.Location =
                new Point(
                    650,
                    104);

            _panel.Size =
                new Size(
                    594,
                    665);

            _panel.Radius =
                22;

            _panel.FillColor =
                PanelBg;

            _panel.BorderColor =
                Color.FromArgb(64, 33, 68);

            var small =
                MakeLabel(
                    "ESCOLHA SEU PRODUTO",
                    8.5f,
                    FontStyle.Regular,
                    TextSecondary,
                    45,
                    45);

            small.Parent =
                _panel;

            var title =
                MakeLabel(
                    "MEUS PRODUTOS",
                    28f,
                    FontStyle.Bold,
                    TextPrimary,
                    45,
                    72);

            title.Parent =
                _panel;

            var subtitle =
                MakeLabel(
                    "Seu acesso e status são sincronizados com sua conta.",
                    9.5f,
                    FontStyle.Regular,
                    TextSecondary,
                    46,
                    121);

            subtitle.Parent =
                _panel;

            _chipHost.Parent =
                _panel;

            _chipHost.BackColor =
                Color.Transparent;

            _chipHost.Location =
                new Point(
                    45,
                    147);

            _chipHost.Size =
                new Size(
                    504,
                    28);

            var game =
                new RoundedPanel
                {
                    Parent =
                        _panel,

                    Location =
                        new Point(
                            45,
                            178),

                    Size =
                        new Size(
                            504,
                            176),

                    Radius =
                        16,

                    FillColor =
                        Color.FromArgb(16, 8, 17),

                    BorderColor =
                        Color.FromArgb(48, 31, 64)
                };

            var icon =
                new Label
                {
                    Parent =
                        game,

                    Text =
                        "CS",

                    Font =
                        FontOf(
                            22f,
                            FontStyle.Bold),

                    ForeColor =
                        Color.FromArgb(16, 9, 19),

                    BackColor =
                        Color.FromArgb(
                            222,
                            164,
                            71),

                    TextAlign =
                        ContentAlignment.MiddleCenter,

                    Location =
                        new Point(
                            22,
                            28),

                    Size =
                        new Size(
                            75,
                            75)
                };

            var product =
                MakeLabel(
                    "Counter-Strike 2",
                    18f,
                    FontStyle.Bold,
                    TextPrimary,
                    120,
                    31);

            product.Parent =
                game;

            var category =
                MakeLabel(
                    "CS2 • WINDOWS",
                    7.5f,
                    FontStyle.Bold,
                    TextSecondary,
                    122,
                    66);

            category.Parent =
                game;

            _icon =
                icon;

            _productName =
                product;

            _category =
                category;

            _access.Parent =
                game;

            _access.Font =
                FontOf(
                    8.5f,
                    FontStyle.Bold);

            _access.BackColor =
                Color.Transparent;

            _access.AutoSize =
                true;

            _access.Location =
                new Point(
                    122,
                    98);

            _status.Parent =
                game;

            _status.Font =
                FontOf(
                    8.5f,
                    FontStyle.Bold);

            _status.BackColor =
                Color.Transparent;

            _status.AutoSize =
                true;

            _status.Location =
                new Point(
                    390,
                    37);

            _statusMessage.Parent =
                _panel;

            _statusMessage.Font =
                FontOf(
                    8.5f,
                    FontStyle.Regular);

            _statusMessage.ForeColor =
                TextSecondary;

            _statusMessage.BackColor =
                Color.Transparent;

            _statusMessage.TextAlign =
                ContentAlignment.MiddleLeft;

            _statusMessage.Location =
                new Point(
                    45,
                    380);

            _statusMessage.Size =
                new Size(
                    504,
                    48);

            _start.Parent =
                _panel;

            _start.Text =
                "INICIAR COUNTER-STRIKE 2     →";

            _start.Location =
                new Point(
                    45,
                    449);

            _start.Size =
                new Size(
                    504,
                    62);

            _start.AccentColor =
                Accent;

            _start.Enabled =
                false;

            _start.Click +=
                async (_, _) =>
                    await StartProductAsync();

            _buy.Parent =
                _panel;

            _buy.Text =
                "COMPRAR / ATIVAR ACESSO";

            StyleSecondaryButton(
                _buy,

                new Point(
                    45,
                    529),

                new Size(
                    316,
                    46));

            _buy.Click +=
                (_, _) =>
                    OpenPortal(
                        "account#plans");

            _refresh.Parent =
                _panel;

            _refresh.Text =
                "ATUALIZAR";

            StyleSecondaryButton(
                _refresh,

                new Point(
                    374,
                    529),

                new Size(
                    175,
                    46));

            _refresh.Click +=
                async (_, _) =>
                    await RefreshAccountAsync();

            var note =
                MakeLabel(
                    "Após comprar no site, clique em ATUALIZAR para sincronizar.",
                    7.5f,
                    FontStyle.Regular,
                    TextSecondary,
                    45,
                    600);

            note.Parent =
                _panel;
        }

        private void BuildWindowButtons()
        {
            var minimize =
                new Button
                {
                    Parent =
                        _background,

                    Text =
                        "—",

                    FlatStyle =
                        FlatStyle.Flat,

                    BackColor =
                        Color.Transparent,

                    ForeColor =
                        TextSecondary,

                    Location =
                        new Point(
                            1213,
                            18),

                    Size =
                        new Size(
                            36,
                            30)
                };

            minimize.FlatAppearance.BorderSize =
                0;

            minimize.Click +=
                (_, _) =>
                    WindowState =
                        FormWindowState.Minimized;

            var close =
                new Button
                {
                    Parent =
                        _background,

                    Text =
                        "×",

                    FlatStyle =
                        FlatStyle.Flat,

                    BackColor =
                        Color.Transparent,

                    ForeColor =
                        TextSecondary,

                    Location =
                        new Point(
                            1250,
                            18),

                    Size =
                        new Size(
                            36,
                            30)
                };

            close.FlatAppearance.BorderSize =
                0;

            close.Click +=
                (_, _) =>
                    Close();
        }

        private async Task RefreshAccountAsync()
        {
            if (_refreshing)
            {
                return;
            }

            _refreshing =
                true;

            _refresh.Enabled =
                false;

            _statusMessage.Text =
                "Sincronizando conta...";

            try
            {
                ClientPortalApi.AccountSnapshot? account =
                    await ClientPortalApi.RefreshAsync();

                if (account == null)
                {
                    _statusMessage.Text =
                        "Não foi possível sincronizar sua conta. Faça login novamente.";

                    _start.Enabled =
                        false;

                    return;
                }

                RenderAccount(
                    account);
            }
            finally
            {
                _refreshing =
                    false;

                _refresh.Enabled =
                    true;
            }
        }

        private void RenderAccount(
            ClientPortalApi.AccountSnapshot account)
        {
            _account =
                account;

            List<ClientPortalApi.AccountProduct> owned =
                OwnedProducts(account);

            ClientPortalApi.AccountProduct current =
                owned.FirstOrDefault(p => p.Code == _selected) ??
                owned.FirstOrDefault(p => p.HasAccess) ??
                owned[0];

            _selected =
                current.Code;

            RebuildChips(owned);
            ApplyProductIdentity(current);

            // Only CS2 has an admin-published status; other products report "unknown" (start stays allowed).
            ClientPortalApi.ProductStatus productStatus =
                current.Code == "cs2"
                    ? account.Status
                    : new ClientPortalApi.ProductStatus
                    {
                        Status = "unknown",
                        Message = ""
                    };

            _username.Text =
                account.User.Username;

            _email.Text =
                account.User.Email;

            _plan.Text =
                current.HasAccess
                    ? current.PlanLabel ??
                      current.Plan ??
                      "Ativo"
                    : "Sem acesso";

            _days.Text =
                current.Lifetime
                    ? "∞"
                    : current.DaysRemaining
                        .ToString();

            _expires.Text =
                current.ExpiresAt
                    ?.ToLocalTime()
                    .ToString(
                        "dd/MM/yyyy HH:mm") ??
                "—";

            _access.Text =
                current.HasAccess
                    ? "●  ACESSO ATIVO"
                    : "●  SEM ACESSO";

            _access.ForeColor =
                current.HasAccess
                    ? Accent
                    : Color.FromArgb(
                        235,
                        86,
                        86);

            string status =
                productStatus.Status
                    .Trim()
                    .ToLowerInvariant();

            _status.Text =
                status switch
                {
                    "online" =>
                        "● ONLINE",

                    "maintenance" =>
                        "● MANUTENÇÃO",

                    "unknown" =>
                        "● SEM STATUS",

                    _ =>
                        "● OFFLINE"
                };

            _status.ForeColor =
                status switch
                {
                    "online" =>
                        Accent,

                    "unknown" =>
                        TextSecondary,

                    "maintenance" =>
                        Color.FromArgb(
                            242,
                            201,
                            76),

                    _ =>
                        Color.FromArgb(
                            235,
                            86,
                            86)
                };

            _statusMessage.Text =
                status ==
                "maintenance"
                    ? (
                        string.IsNullOrWhiteSpace(
                            productStatus.Message)
                            ? "Produto em manutenção. Caso prossiga, o uso é por sua conta e risco."
                            : productStatus.Message +
                              "  Caso prossiga, o uso é por sua conta e risco."
                    )
                    : productStatus.Message;

            _start.Enabled =
                current.HasAccess &&
                status !=
                "offline";

            _buy.Visible =
                !current.HasAccess;
        }

        private static List<ClientPortalApi.AccountProduct> OwnedProducts(
            ClientPortalApi.AccountSnapshot account)
        {
            return account.Products.Count > 0
                ? account.Products
                : new List<ClientPortalApi.AccountProduct>
                {
                    account.Product
                };
        }

        private static string DisplayName(
            string code)
        {
            return code switch
            {
                CombatArmsCode =>
                    "Combat Arms Brasil 7",

                _ =>
                    "Counter-Strike 2"
            };
        }

        private void RebuildChips(
            List<ClientPortalApi.AccountProduct> owned)
        {
            _chipHost.Controls.Clear();

            int x =
                0;

            foreach (ClientPortalApi.AccountProduct item in owned)
            {
                string code =
                    item.Code;

                bool selected =
                    code == _selected;

                var chip =
                    new Button
                    {
                        Parent =
                            _chipHost,

                        Text =
                            DisplayName(code) +
                            (item.HasAccess ? "" : "  (sem acesso)"),

                        FlatStyle =
                            FlatStyle.Flat,

                        BackColor =
                            selected
                                ? Color.FromArgb(52, 30, 92)
                                : Color.FromArgb(12, 8, 17),

                        ForeColor =
                            selected
                                ? TextPrimary
                                : TextSecondary,

                        Font =
                            FontOf(
                                8f,
                                FontStyle.Bold),

                        Cursor =
                            Cursors.Hand,

                        Location =
                            new Point(
                                x,
                                0),

                        Size =
                            new Size(
                                code == CombatArmsCode ? 210 : 170,
                                28)
                    };

                chip.FlatAppearance.BorderSize =
                    1;

                chip.FlatAppearance.BorderColor =
                    selected
                        ? Accent
                        : Color.FromArgb(52, 38, 70);

                chip.Click +=
                    (_, _) =>
                    {
                        if (_account == null ||
                            _selected == code)
                        {
                            return;
                        }

                        _selected =
                            code;

                        RenderAccount(
                            _account);
                    };

                x +=
                    chip.Width + 8;
            }
        }

        private void ApplyProductIdentity(
            ClientPortalApi.AccountProduct current)
        {
            bool combatArms =
                current.Code == CombatArmsCode;

            if (_icon != null)
            {
                _icon.Text =
                    combatArms ? "CA" : "CS";

                _icon.BackColor =
                    combatArms
                        ? Accent
                        : Color.FromArgb(222, 164, 71);
            }

            if (_productName != null)
            {
                _productName.Text =
                    combatArms
                        ? "External — Brasil 7"
                        : "Counter-Strike 2";

                _productName.Font =
                    FontOf(
                        combatArms ? 15f : 18f,
                        FontStyle.Bold);
            }

            if (_category != null)
            {
                _category.Text =
                    combatArms
                        ? "COMBAT ARMS • EXTERNAL • BRASIL 7"
                        : "CS2 • WINDOWS";
            }

            _start.Text =
                combatArms
                    ? "INICIAR COMBAT ARMS BRASIL 7     →"
                    : "INICIAR COUNTER-STRIKE 2     →";
        }

        private async Task StartCombatArmsAsync()
        {
            _start.Enabled =
                false;

            try
            {
                ClientPortalApi.AccountSnapshot? account =
                    await ClientPortalApi.RefreshAsync();

                if (account == null)
                {
                    MessageBox.Show(
                        "Não foi possível validar sua conta no servidor.",
                        "legitbaratinho.xyz",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Warning);

                    return;
                }

                RenderAccount(
                    account);

                if (!OwnedProducts(account).Any(
                        p => p.Code == CombatArmsCode &&
                             p.HasAccess))
                {
                    MessageBox.Show(
                        "Sua conta não possui acesso ativo ao Combat Arms Brasil 7.",
                        "legitbaratinho.xyz",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Information);

                    return;
                }

                MessageBox.Show(
                    this,
                    "Para o overlay funcionar no Combat Arms Brasil 7, use o jogo em modo janela na resolução do monitor e pressione F7 dentro da partida (tela cheia sem bordas). O jogo e o external precisam rodar como administrador.",
                    "Modo de exibição do Combat Arms Brasil 7",
                    MessageBoxButtons.OK,
                    MessageBoxIcon.Information);

                string idleText =
                    _start.Text;

                (bool success, string message) =
                    await CombatArmsLauncher.StartAsync(
                        (stage, done, total) =>
                            _start.Text =
                                stage switch
                                {
                                    SessionStage.Manifest => "VERIFICANDO VERSÃO...",
                                    SessionStage.Download => total > 0
                                        ? "BAIXANDO " + (done * 100 / total) + "%"
                                        : "BAIXANDO...",
                                    SessionStage.Verify => "VERIFICANDO ARQUIVO...",
                                    SessionStage.Launch => "INICIANDO...",
                                    SessionStage.Running => "EM EXECUÇÃO",
                                    _ => "LIMPANDO ARQUIVOS..."
                                });

                _start.Text =
                    idleText;

                // The product ran until the user closed it; only failures need a dialog.
                if (!success)
                {
                    MessageBox.Show(
                        this,
                        message,
                        "legitbaratinho.xyz — Combat Arms Brasil 7",
                        MessageBoxButtons.OK,
                        MessageBoxIcon.Warning);
                }
            }
            finally
            {
                _start.Enabled =
                    _account != null &&
                    OwnedProducts(_account).Any(
                        p => p.Code == CombatArmsCode &&
                             p.HasAccess);
            }
        }

        private void ShowDisplayNotice()
        {
            string warning = AimTheme.Intensity >= .75f ? "\n\n" + AimTheme.Warning : "";
            MessageBox.Show(this, "Para o overlay funcionar, configure o CS2 em Tela cheia em janela." + warning,
                "Modo de exibição do CS2", MessageBoxButtons.OK, MessageBoxIcon.Information);
        }

        private async Task StartProductAsync()
        {
            if (_selected == CombatArmsCode)
            {
                await StartCombatArmsAsync();
                return;
            }

            ShowDisplayNotice();
            _start.Enabled =
                false;

            ClientPortalApi.AccountSnapshot? account =
                await ClientPortalApi.RefreshAsync();

            if (account == null)
            {
                MessageBox.Show(
                    "Não foi possível validar sua conta no servidor.",

                    "legitbaratinho.xyz",

                    MessageBoxButtons.OK,

                    MessageBoxIcon.Warning);

                _start.Enabled =
                    true;

                return;
            }

            if (!account.Product.HasAccess)
            {
                RenderAccount(
                    account);

                MessageBox.Show(
                    "Sua conta não possui acesso ativo ao produto.",

                    "legitbaratinho.xyz",

                    MessageBoxButtons.OK,

                    MessageBoxIcon.Information);

                return;
            }

            string status =
                account.Status.Status
                    .Trim()
                    .ToLowerInvariant();

            if (status ==
                "offline")
            {
                RenderAccount(
                    account);

                MessageBox.Show(
                    string.IsNullOrWhiteSpace(
                        account.Status.Message)
                        ? "O produto está offline no momento."
                        : account.Status.Message,

                    "legitbaratinho.xyz — Offline",

                    MessageBoxButtons.OK,

                    MessageBoxIcon.Error);

                return;
            }

            if (status ==
                "maintenance")
            {
                bool confirmed =
                    MaintenanceWarningForm.Confirm(
                        this,
                        account.Status.Message);

                if (!confirmed)
                {
                    RenderAccount(
                        account);

                    return;
                }
            }

            DialogResult =
                DialogResult.OK;

            Close();
        }

        private void AddMetric(
            Control parent,
            string caption,
            Label value,
            int y)
        {
            var title =
                MakeLabel(
                    caption,
                    7.5f,
                    FontStyle.Bold,
                    TextSecondary,
                    24,
                    y);

            title.Parent =
                parent;

            value.Parent =
                parent;

            value.Font =
                FontOf(
                    15f,
                    FontStyle.Bold);

            value.ForeColor =
                TextPrimary;

            value.BackColor =
                Color.Transparent;

            value.AutoSize =
                true;

            value.Location =
                new Point(
                    205,
                    y - 5);
        }

        private static void StyleSecondaryButton(
            Button button,
            Point location,
            Size size)
        {
            button.FlatStyle =
                FlatStyle.Flat;

            button.FlatAppearance.BorderColor =
                Color.FromArgb(52, 38, 70);

            button.FlatAppearance.BorderSize =
                1;

            button.BackColor =
                Color.FromArgb(12, 8, 17);

            button.ForeColor =
                TextPrimary;

            button.Font =
                FontOf(
                    8f,
                    FontStyle.Bold);

            button.Cursor =
                Cursors.Hand;

            button.Location =
                location;

            button.Size =
                size;
        }

        private static Label MakeLabel(
            string text,
            float size,
            FontStyle style,
            Color color,
            int x,
            int y)
        {
            return new Label
            {
                Text =
                    text,

                Font =
                    FontOf(
                        size,
                        style),

                ForeColor =
                    color,

                BackColor =
                    Color.Transparent,

                AutoSize =
                    true,

                Location =
                    new Point(
                        x,
                        y)
            };
        }

        private static Font FontOf(
            float size,
            FontStyle style)
        {
            return new Font(
                "Segoe UI",
                size,
                style);
        }

        private static void OpenPortal(
            string path)
        {
            try
            {
                Process.Start(
                    new ProcessStartInfo
                    {
                        FileName =
                            ClientPortalApi.PortalBaseUrl +
                            path,

                        UseShellExecute =
                            true
                    });
            }
            catch
            {
            }
        }

        private void ApplyRoundedRegion()
        {
            if (Width <= 0 ||
                Height <= 0)
            {
                return;
            }

            using var path =
                new GraphicsPath();

            Rectangle r =
                new(
                    0,
                    0,
                    Width,
                    Height);

            const int radius =
                22;

            int d =
                radius * 2;

            path.AddArc(
                r.Left,
                r.Top,
                d,
                d,
                180,
                90);

            path.AddArc(
                r.Right - d,
                r.Top,
                d,
                d,
                270,
                90);

            path.AddArc(
                r.Right - d,
                r.Bottom - d,
                d,
                d,
                0,
                90);

            path.AddArc(
                r.Left,
                r.Bottom - d,
                d,
                d,
                90,
                90);

            path.CloseFigure();

            Region =
                new Region(
                    path);
        }

        public static bool ShowSelection()
        {
            using var form =
                new ProductSelectionForm();

            return form.ShowDialog() ==
                   DialogResult.OK;
        }
    }
}
