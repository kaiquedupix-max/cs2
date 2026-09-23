using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace Mac1ota_Menu.Classes
{
    internal sealed class ProductSelectionForm : Form
    {
        private static readonly Color Bg =
            Color.FromArgb(
                5,
                10,
                11);

        private static readonly Color PanelBg =
            Color.FromArgb(
                11,
                19,
                21);

        private static readonly Color Accent =
            Color.FromArgb(
                21,
                232,
                169);

        private static readonly Color TextPrimary =
            Color.FromArgb(
                239,
                244,
                244);

        private static readonly Color TextSecondary =
            Color.FromArgb(
                126,
                143,
                148);

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
                        Color.FromArgb(
                            8,
                            16,
                            17),

                    BorderColor =
                        Color.FromArgb(
                            31,
                            52,
                            53)
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
                Color.FromArgb(
                    39,
                    58,
                    62);

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
                        Color.FromArgb(
                            8,
                            15,
                            17),

                    BorderColor =
                        Color.FromArgb(
                            35,
                            60,
                            55)
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
                        Color.FromArgb(
                            13,
                            15,
                            15),

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
            _username.Text =
                account.User.Username;

            _email.Text =
                account.User.Email;

            _plan.Text =
                account.Product.HasAccess
                    ? account.Product.PlanLabel ??
                      account.Product.Plan ??
                      "Ativo"
                    : "Sem acesso";

            _days.Text =
                account.Product.DaysRemaining
                    .ToString();

            _expires.Text =
                account.Product.ExpiresAt
                    ?.ToLocalTime()
                    .ToString(
                        "dd/MM/yyyy HH:mm") ??
                "—";

            _access.Text =
                account.Product.HasAccess
                    ? "●  ACESSO ATIVO"
                    : "●  SEM ACESSO";

            _access.ForeColor =
                account.Product.HasAccess
                    ? Accent
                    : Color.FromArgb(
                        235,
                        86,
                        86);

            string status =
                account.Status.Status
                    .Trim()
                    .ToLowerInvariant();

            _status.Text =
                status switch
                {
                    "online" =>
                        "● ONLINE",

                    "maintenance" =>
                        "● MANUTENÇÃO",

                    _ =>
                        "● OFFLINE"
                };

            _status.ForeColor =
                status switch
                {
                    "online" =>
                        Accent,

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
                            account.Status.Message)
                            ? "Produto em manutenção. Caso prossiga, o uso é por sua conta e risco."
                            : account.Status.Message +
                              "  Caso prossiga, o uso é por sua conta e risco."
                    )
                    : account.Status.Message;

            _start.Enabled =
                account.Product.HasAccess &&
                status !=
                "offline";

            _buy.Visible =
                !account.Product.HasAccess;
        }

        private async Task StartProductAsync()
        {
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
                Color.FromArgb(
                    38,
                    70,
                    61);

            button.FlatAppearance.BorderSize =
                1;

            button.BackColor =
                Color.FromArgb(
                    8,
                    17,
                    15);

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
