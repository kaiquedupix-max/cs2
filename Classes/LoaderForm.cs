using System.ComponentModel;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Runtime.InteropServices;
using System.Windows.Forms;

namespace Mac1ota_Menu.Classes
{
    internal sealed class LoaderForm : Form
    {
        private static readonly Color Bg =
            Color.FromArgb(7, 7, 8);

        private static readonly Color PanelBg =
            Color.FromArgb(14, 14, 16);

        private static readonly Color Accent =
            Color.FromArgb(255, 55, 43);

        private static readonly Color AccentDark =
            Color.FromArgb(177, 25, 18);

        private static readonly Color TextPrimary =
            Color.FromArgb(244, 244, 244);

        private static readonly Color TextSecondary =
            Color.FromArgb(132, 132, 138);

        private readonly LoaderBackgroundCanvas _background = new();
        private readonly RoundedPanel _loginPanel = new();

        private readonly ModernTextBox _username = new();
        private readonly ModernTextBox _password = new();

        private readonly GlowButton _enter = new();
        private readonly NeonCheckBox _remember = new();

        private readonly ProductCard _productCs2 = new();
        private readonly ProductCard _productRust = new();
        private readonly ProductCard _productFreeFire = new();
        private readonly ProductCard _productFortnite = new();

        private readonly Button _showPassword = new();

        private readonly Label _status = new();
        private readonly ModernProgressBar _progress = new();

        private readonly Label _loginTitle = new();
        private readonly Label _loginSubtitle = new();

        private readonly System.Windows.Forms.Timer _timer = new();

        private int _value;
        private bool _waitingForCs2;
        private bool _selectingProduct;

        private static LoaderForm? _startupForm;

        public static bool StartupVisible =>
            _startupForm != null &&
            !_startupForm.IsDisposed;

        public LoaderForm()
        {
            SuspendLayout();

            Text = "Brasa Project.gg";

            ClientSize = new Size(
                1300,
                825);

            StartPosition =
                FormStartPosition.CenterScreen;

            FormBorderStyle =
                FormBorderStyle.None;

            MaximizeBox = false;
            MinimizeBox = false;

            BackColor = Bg;
            ForeColor = TextPrimary;

            DoubleBuffered = true;

            SetStyle(
                ControlStyles.AllPaintingInWmPaint |
                ControlStyles.UserPaint |
                ControlStyles.OptimizedDoubleBuffer,
                true);

            BuildBackground();
            BuildHeader();
            BuildBranding();
            BuildLoginPanel();
            BuildWindowButtons();

            Resize += (_, _) =>
                ApplyRoundedRegion();

            Shown += (_, _) =>
            {
                ApplyRoundedRegion();
                Activate();
            };

            // 100ms x 100 = aproximadamente 10 segundos
            _timer.Interval = 100;

            _timer.Tick += LoadingTick;

            ResumeLayout(false);
        }

        // ============================================================
        // BACKGROUND
        // ============================================================

        private void BuildBackground()
        {
            _background.Dock =
                DockStyle.Fill;

            _background.BackColor =
                Bg;

            string imagePath =
                Path.Combine(
                    AppContext.BaseDirectory,
                    "Resources",
                    "LoaderBackground.png");

            if (File.Exists(imagePath))
            {
                using var image =
                    Image.FromFile(imagePath);

                _background.Artwork =
                    new Bitmap(image);
            }

            Controls.Add(
                _background);

            _background.SendToBack();

            EnableDrag(
                _background);
        }

        // ============================================================
        // HEADER
        // ============================================================

        private void BuildHeader()
        {
            var mark =
                new BrasaFlame
                {
                    Parent =
                        _background,

                    Location =
                        new Point(
                            22,
                            18),

                    Size =
                        new Size(
                            34,
                            38),

                    AccentColor =
                        Accent
                };

            var product =
                new Label
                {
                    Parent =
                        _background,

                    Text =
                        "Brasa Project.gg",

                    Font =
                        FontOf(
                            10.5f,
                            FontStyle.Regular),

                    ForeColor =
                        TextPrimary,

                    BackColor =
                        Color.Transparent,

                    AutoSize =
                        true,

                    Location =
                        new Point(
                            66,
                            29)
                };

            var version =
                new Label
                {
                    Parent =
                        _background,

                    Text =
                        "v1.0.0",

                    Font =
                        FontOf(
                            7.5f,
                            FontStyle.Regular),

                    ForeColor =
                        Color.FromArgb(
                            95,
                            95,
                            100),

                    BackColor =
                        Color.Transparent,

                    AutoSize =
                        true,

                    Location =
                        new Point(
                            184,
                            32)
                };

            EnableDrag(mark);
            EnableDrag(product);
            EnableDrag(version);
        }

        // ============================================================
        // BRANDING        // ============================================================
        // BRANDING
        // ============================================================

        private void BuildBranding()
        {
            var flame =
                new BrasaFlame
                {
                    Parent =
                        _background,

                    Location =
                        new Point(
                            188,
                            150),

                    Size =
                        new Size(
                            210,
                            220),

                    AccentColor =
                        Accent
                };

            var brasa =
                new Label
                {
                    Parent =
                        _background,

                    Text =
                        "BRASA",

                    Font =
                        FontOf(
                            60f,
                            FontStyle.Bold),

                    ForeColor =
                        Color.FromArgb(
                            246,
                            246,
                            246),

                    BackColor =
                        Color.Transparent,

                    AutoSize =
                        true,

                    Location =
                        new Point(
                            116,
                            365)
                };

            var project =
                new Label
                {
                    Parent =
                        _background,

                    Text =
                        "P R O J E C T",

                    Font =
                        FontOf(
                            16f,
                            FontStyle.Bold),

                    ForeColor =
                        Accent,

                    BackColor =
                        Color.Transparent,

                    AutoSize =
                        true,

                    Location =
                        new Point(
                            212,
                            455)
                };

            var slogan =
                new Label
                {
                    Parent =
                        _background,

                    Text =
                        "P E R F O R M A N C E   •   P R E C I S Ã O   •   C O N T R O L E",

                    Font =
                        FontOf(
                            7.5f,
                            FontStyle.Regular),

                    ForeColor =
                        Color.FromArgb(
                            205,
                            205,
                            208),

                    BackColor =
                        Color.Transparent,

                    AutoSize =
                        true,

                    Location =
                        new Point(
                            77,
                            510)
                };

            var footerLine =
                new Panel
                {
                    Parent =
                        _background,

                    BackColor =
                        Accent,

                    Location =
                        new Point(
                            35,
                            766),

                    Size =
                        new Size(
                            2,
                            28)
                };

            var footer =
                new Label
                {
                    Parent =
                        _background,

                    Text =
                        "Feito no Brasil. Feito pra competir.",

                    Font =
                        FontOf(
                            8.5f,
                            FontStyle.Regular),

                    ForeColor =
                        Color.FromArgb(
                            196,
                            196,
                            199),

                    BackColor =
                        Color.Transparent,

                    AutoSize =
                        true,

                    Location =
                        new Point(
                            52,
                            771)
                };

            var country =
                new Label
                {
                    Parent =
                        _background,

                    Text =
                        "UM PROJETO BRASILEIRO  🇧🇷",

                    Font =
                        FontOf(
                            7.5f,
                            FontStyle.Bold),

                    ForeColor =
                        Color.FromArgb(
                            145,
                            145,
                            150),

                    BackColor =
                        Color.Transparent,

                    AutoSize =
                        true,

                    Location =
                        new Point(
                            438,
                            776)
                };

            EnableDrag(flame);
            EnableDrag(brasa);
            EnableDrag(project);
            EnableDrag(slogan);
            EnableDrag(footer);
            EnableDrag(country);
        }

        // ============================================================
        // LOGIN        // ============================================================
        // LOGIN
        // ============================================================

        private void BuildLoginPanel()
        {
            _loginPanel.Parent =
                _background;

            _loginPanel.Location =
                new Point(
                    662,
                    94);

            _loginPanel.Size =
                new Size(
                    582,
                    690);

            _loginPanel.Radius =
                22;

            _loginPanel.FillColor =
                PanelBg;

            _loginPanel.BorderColor =
                Color.FromArgb(
                    48,
                    48,
                    52);

            _loginPanel.BorderWidth =
                1;

            var welcome =
                new Label
                {
                    Parent =
                        _loginPanel,

                    Text =
                        "B E M - V I N D O   A O",

                    Font =
                        FontOf(
                            8.5f,
                            FontStyle.Regular),

                    ForeColor =
                        TextSecondary,

                    BackColor =
                        Color.Transparent,

                    AutoSize =
                        true,

                    Location =
                        new Point(
                            208,
                            50)
                };

            _loginTitle.Parent =
                _loginPanel;

            _loginTitle.Text =
                "BRASA PROJECT.GG";

            _loginTitle.Font =
                FontOf(
                    28f,
                    FontStyle.Bold);

            _loginTitle.ForeColor =
                TextPrimary;

            _loginTitle.BackColor =
                Color.Transparent;

            _loginTitle.AutoSize =
                true;

            _loginTitle.Location =
                new Point(
                    118,
                    81);

            _loginSubtitle.Parent =
                _loginPanel;

            _loginSubtitle.Text =
                "Faça login para continuar";

            _loginSubtitle.Font =
                FontOf(
                    9.5f,
                    FontStyle.Regular);

            _loginSubtitle.ForeColor =
                TextSecondary;

            _loginSubtitle.BackColor =
                Color.Transparent;

            _loginSubtitle.AutoSize =
                true;

            _loginSubtitle.Location =
                new Point(
                    205,
                    128);

            _username.Parent =
                _loginPanel;

            _username.Location =
                new Point(
                    45,
                    185);

            _username.Size =
                new Size(
                    504,
                    56);

            _username.PlaceholderText =
                "Usuário";

            _password.Parent =
                _loginPanel;

            _password.Location =
                new Point(
                    45,
                    255);

            _password.Size =
                new Size(
                    504,
                    56);

            _password.PlaceholderText =
                "Senha";

            _password.UseSystemPasswordChar =
                true;

            _showPassword.Parent =
                _loginPanel;

            _showPassword.Text =
                "MOSTRAR";

            _showPassword.FlatStyle =
                FlatStyle.Flat;

            _showPassword
                .FlatAppearance
                .BorderSize = 0;

            _showPassword.BackColor =
                Color.FromArgb(
                    23,
                    23,
                    25);

            _showPassword.ForeColor =
                TextSecondary;

            _showPassword.Font =
                FontOf(
                    7f,
                    FontStyle.Bold);

            _showPassword.Cursor =
                Cursors.Hand;

            _showPassword.Size =
                new Size(
                    69,
                    25);

            _showPassword.Location =
                new Point(
                    466,
                    270);

            _showPassword.Click +=
                (_, _) =>
                {
                    _password.UseSystemPasswordChar =
                        !_password.UseSystemPasswordChar;

                    _showPassword.Text =
                        _password.UseSystemPasswordChar
                            ? "MOSTRAR"
                            : "OCULTAR";
                };

            _showPassword.MouseEnter +=
                (_, _) =>
                {
                    _showPassword.ForeColor =
                        Accent;
                };

            _showPassword.MouseLeave +=
                (_, _) =>
                {
                    _showPassword.ForeColor =
                        TextSecondary;
                };

            _remember.Parent =
                _loginPanel;

            _remember.Text =
                "Lembrar de mim";

            _remember.Location =
                new Point(
                    47,
                    327);

            _remember.Size =
                new Size(
                    150,
                    24);

            var forgot =
                new Label
                {
                    Parent =
                        _loginPanel,

                    Text =
                        "Esqueci minha senha?",

                    Font =
                        FontOf(
                            8.5f,
                            FontStyle.Regular),

                    ForeColor =
                        TextSecondary,

                    BackColor =
                        Color.Transparent,

                    Cursor =
                        Cursors.Hand,

                    AutoSize =
                        true,

                    Location =
                        new Point(
                            413,
                            332)
                };

            forgot.MouseEnter +=
                (_, _) =>
                {
                    forgot.ForeColor =
                        Accent;
                };

            forgot.MouseLeave +=
                (_, _) =>
                {
                    forgot.ForeColor =
                        TextSecondary;
                };

            BuildProductSelector();

            _enter.Parent =
                _loginPanel;

            _enter.Text =
                "ENTRAR     →";

            _enter.Location =
                new Point(
                    45,
                    372);

            _enter.Size =
                new Size(
                    504,
                    62);

            _enter.AccentColor =
                Accent;

            _enter.Click +=
                (_, _) =>
                {
                    if (_selectingProduct)
                    {
                        StartSelectedProduct();
                        return;
                    }

                    ShowProductSelection();
                };

            _status.Parent =
                _loginPanel;

            _status.Text =
                "Pronto para iniciar";

            _status.Font =
                FontOf(
                    8.5f,
                    FontStyle.Regular);

            _status.ForeColor =
                TextSecondary;

            _status.BackColor =
                Color.Transparent;

            _status.TextAlign =
                ContentAlignment.MiddleCenter;

            _status.Location =
                new Point(
                    45,
                    464);

            _status.Size =
                new Size(
                    504,
                    22);

            _progress.Parent =
                _loginPanel;

            _progress.Location =
                new Point(
                    45,
                    495);

            _progress.Size =
                new Size(
                    504,
                    8);

            _progress.Value =
                0;

            _progress.AccentColor =
                Accent;

            AddFeature(
                "⚡",
                "Seguro",
                "Proteção avançada",
                19,
                542);

            AddFeature(
                "◇",
                "Atualizado",
                "Sempre compatível",
                160,
                542);

            AddFeature(
                "▥",
                "Desempenho",
                "Leve e otimizado",
                301,
                542);

            AddFeature(
                "⚙",
                "Suporte",
                "Sempre online",
                442,
                542);
        }

        private void BuildProductSelector()
        {
            ConfigureProductOption(
                _productCs2,
                "CS",
                "Counter-Strike 2",
                "O N L I N E",
                174,
                true);

            ConfigureProductOption(
                _productRust,
                "R",
                "Rust",
                "E M   B R E V E",
                258,
                false);

            ConfigureProductOption(
                _productFreeFire,
                "FF",
                "Free Fire",
                "E M   B R E V E",
                342,
                false);

            ConfigureProductOption(
                _productFortnite,
                "F",
                "Fortnite",
                "E M   B R E V E",
                426,
                false);

            _productCs2.Click +=
                (_, _) =>
                {
                    _productCs2.Selected =
                        true;

                    _status.ForeColor =
                        Accent;

                    _status.Text =
                        "Counter-Strike 2 selecionado.";
                };
        }

        private void ConfigureProductOption(
            ProductCard option,
            string icon,
            string title,
            string status,
            int y,
            bool available)
        {
            option.Parent =
                _loginPanel;

            option.IconText =
                icon;

            option.ProductTitle =
                title;

            option.StatusText =
                status;

            option.Location =
                new Point(
                    39,
                    y);

            option.Size =
                new Size(
                    504,
                    72);

            option.AccentColor =
                Accent;

            option.Available =
                available;

            option.Visible =
                false;
        }

        private void SetProductOptionsVisible(
            bool visible)
        {
            _productCs2.Visible =
                visible;

            _productRust.Visible =
                visible;

            _productFreeFire.Visible =
                visible;

            _productFortnite.Visible =
                visible;
        }

        private void SetForgotPasswordVisible(
            bool visible)
        {
            foreach (Control control in
                     _loginPanel.Controls)
            {
                if (control is Label label &&
                    label.Text ==
                    "Esqueci minha senha?")
                {
                    label.Visible =
                        visible;

                    return;
                }
            }
        }

        private void ShowProductSelection()
        {
            _timer.Stop();

            _selectingProduct =
                true;

            _username.Visible =
                false;

            _password.Visible =
                false;

            _showPassword.Visible =
                false;

            _remember.Visible =
                false;

            SetForgotPasswordVisible(
                false);

            _productCs2.Selected =
                true;

            SetProductOptionsVisible(
                true);

            _loginTitle.Text =
                "BRASA PROJECT.GG";

            _loginTitle.Font =
                FontOf(
                    24f,
                    FontStyle.Bold);

            _loginTitle.Location =
                new Point(
                    118,
                    80);

            _loginSubtitle.Text =
                "Escolha o seu produto para continuar.";

            _loginSubtitle.Location =
                new Point(
                    169,
                    126);

            _enter.Text =
                "ENTRAR     →";

            _enter.Location =
                new Point(
                    39,
                    520);

            _enter.Size =
                new Size(
                    504,
                    60);

            _enter.Visible =
                true;

            _enter.Enabled =
                true;

            _status.Location =
                new Point(
                    39,
                    605);

            _status.Size =
                new Size(
                    504,
                    22);

            _status.ForeColor =
                Color.FromArgb(
                    110,
                    110,
                    116);

            _status.Text =
                "Versão 1.0.0                                      brasaproject.gg   ●";

            _progress.Visible =
                false;
        }

        private void StartSelectedProduct()
        {
            if (!_productCs2.Selected)
            {
                _status.ForeColor =
                    Color.FromArgb(
                        235,
                        86,
                        86);

                _status.Text =
                    "Selecione o Counter-Strike 2 para continuar.";

                return;
            }

            BeginLoading();
        }

        private void PrepareLoadingLayout()
        {
            _selectingProduct =
                false;

            _username.Visible =
                false;

            _password.Visible =
                false;

            _showPassword.Visible =
                false;

            _remember.Visible =
                false;

            SetForgotPasswordVisible(
                false);

            SetProductOptionsVisible(
                false);

            _enter.Visible =
                false;

            _enter.Location =
                new Point(
                    45,
                    372);

            _enter.Size =
                new Size(
                    504,
                    62);

            _status.Location =
                new Point(
                    45,
                    328);

            _status.Size =
                new Size(
                    504,
                    40);

            _loginTitle.Text =
                "INICIALIZANDO";

            _loginTitle.Font =
                FontOf(
                    28f,
                    FontStyle.Bold);

            _loginTitle.Location =
                new Point(
                    172,
                    189);

            _loginSubtitle.Text =
                "Preparando Brasa Project.gg";

            _loginSubtitle.Location =
                new Point(
                    184,
                    240);

            _status.Location =
                new Point(
                    45,
                    328);

            _status.Size =
                new Size(
                    504,
                    40);

            _status.Font =
                FontOf(
                    10.5f,
                    FontStyle.Regular);

            _progress.Visible =
                true;

            _progress.Location =
                new Point(
                    45,
                    391);

            _progress.Size =
                new Size(
                    504,
                    9);
        }

        private void AddFeature(
            string icon,
            string title,
            string subtitle,
            int x,
            int y)
        {
            var panel =
                new RoundedPanel
                {
                    Parent =
                        _background,

                    Location =
                        new Point(
                            x + 48,
                            y + 74),

                    Size =
                        new Size(
                            116,
                            76),

                    Radius =
                        14,

                    FillColor =
                        Color.FromArgb(
                            16,
                            12,
                            12),

                    BorderColor =
                        Color.FromArgb(
                            62,
                            36,
                            34),

                    BorderWidth =
                        1
                };

            var iconLabel =
                new Label
                {
                    Parent =
                        panel,

                    Text =
                        icon,

                    Font =
                        FontOf(
                            15f,
                            FontStyle.Bold),

                    ForeColor =
                        Accent,

                    BackColor =
                        Color.Transparent,

                    TextAlign =
                        ContentAlignment.MiddleCenter,

                    Location =
                        new Point(
                            0,
                            9),

                    Size =
                        new Size(
                            116,
                            24)
                };

            var titleLabel =
                new Label
                {
                    Parent =
                        panel,

                    Text =
                        title,

                    Font =
                        FontOf(
                            8.5f,
                            FontStyle.Bold),

                    ForeColor =
                        TextPrimary,

                    BackColor =
                        Color.Transparent,

                    TextAlign =
                        ContentAlignment.MiddleCenter,

                    Location =
                        new Point(
                            0,
                            38),

                    Size =
                        new Size(
                            116,
                            19)
                };

            var subtitleLabel =
                new Label
                {
                    Parent =
                        panel,

                    Text =
                        subtitle,

                    Font =
                        FontOf(
                            7f,
                            FontStyle.Regular),

                    ForeColor =
                        TextSecondary,

                    BackColor =
                        Color.Transparent,

                    TextAlign =
                        ContentAlignment.MiddleCenter,

                    Location =
                        new Point(
                            0,
                            59),

                    Size =
                        new Size(
                            116,
                            17)
                };
        }

        // ============================================================
        // WINDOW BUTTONS
        // ============================================================

        private void BuildWindowButtons()
        {
            var minimize =
                new WindowButton
                {
                    Parent =
                        _background,

                    Text =
                        "—",

                    Location =
                        new Point(
                            1213,
                            21),

                    Size =
                        new Size(
                            30,
                            30)
                };

            minimize.Click +=
                (_, _) =>
                {
                    WindowState =
                        FormWindowState.Minimized;
                };

            var close =
                new WindowButton
                {
                    Parent =
                        _background,

                    Text =
                        "×",

                    Location =
                        new Point(
                            1252,
                            21),

                    Size =
                        new Size(
                            30,
                            30),

                    IsCloseButton =
                        true
                };

            close.Click +=
                (_, _) =>
                Close();

            minimize.BringToFront();
            close.BringToFront();
        }

        // ============================================================
        // LOGIN LOADING
        // ============================================================

        private void BeginLoading()
        {
            PrepareLoadingLayout();

            _value =
                0;

            _waitingForCs2 =
                false;

            _progress.Value =
                0;

            _status.ForeColor =
                TextSecondary;

            _status.Text =
                "Atualizando dados...";

            _timer.Start();
        }

        private void LoadingTick(
            object? sender,
            EventArgs e)
        {
            if (!_waitingForCs2)
            {
                _value =
                    System.Math.Min(
                        100,
                        _value + 1);

                _progress.Value =
                    _value;

                if (_value < 20)
                {
                    _status.Text =
                        "Atualizando dados...";
                }
                else if (_value < 40)
                {
                    _status.Text =
                        "Carregando interface...";
                }
                else if (_value < 60)
                {
                    _status.Text =
                        "Sincronizando recursos...";
                }
                else if (_value < 80)
                {
                    _status.Text =
                        "Preparando ambiente...";
                }
                else if (_value < 100)
                {
                    _status.Text =
                        "Finalizando inicialização...";
                }
                else
                {
                    if (!IsCs2Open())
                    {
                        _waitingForCs2 =
                            true;

                        _status.ForeColor =
                            Accent;

                        _status.Text =
                            "Aguardando CS2...";

                        return;
                    }

                    CompleteLogin();
                }

                return;
            }

            _progress.Value =
                100;

            _status.ForeColor =
                Accent;

            _status.Text =
                "Aguardando CS2...";

            if (IsCs2Open())
            {
                CompleteLogin();
            }
        }

        private void CompleteLogin()
        {
            _timer.Stop();

            _status.ForeColor =
                Accent;

            _status.Text =
                "CS2 encontrado. Iniciando...";

            DialogResult =
                DialogResult.OK;

            Close();
        }

        private static bool IsCs2Open()
        {
            try
            {
                Process[] processes =
                    Process.GetProcessesByName(
                        "cs2");

                bool open =
                    processes.Any(
                        process =>
                        {
                            try
                            {
                                return !process.HasExited;
                            }
                            catch
                            {
                                return false;
                            }
                        });

                foreach (Process process in processes)
                {
                    process.Dispose();
                }

                return open;
            }
            catch
            {
                return false;
            }
        }

        // ============================================================
        // STARTUP MODE
        // ============================================================

        private void EnterStartupMode()
        {
            _timer.Stop();

            PrepareLoadingLayout();

            _progress.Value =
                5;

            _status.Text =
                "Atualizando dados...";
        }

        // ============================================================
        // STATIC API
        // ============================================================

        public static bool ShowLogin()
        {
            try
            {
                Application.EnableVisualStyles();

                Application
                    .SetCompatibleTextRenderingDefault(
                        false);

                using var form =
                    new LoaderForm();

                return form.ShowDialog() ==
                       DialogResult.OK;
            }
            catch (Exception ex)
            {
                MessageBox.Show(
                    "Não foi possível abrir o loader.\n\n" +
                    ex.Message,

                    "Brasa Project.gg",

                    MessageBoxButtons.OK,

                    MessageBoxIcon.Error);

                return false;
            }
        }

        public static void ShowStartup()
        {
            var ready =
                new ManualResetEventSlim(
                    false);

            var thread =
                new Thread(() =>
                {
                    try
                    {
                        _startupForm =
                            new LoaderForm();

                        _startupForm
                            .EnterStartupMode();

                        _startupForm.Shown +=
                            (_, _) =>
                            {
                                ready.Set();
                            };

                        Application.Run(
                            _startupForm);
                    }
                    catch
                    {
                        ready.Set();
                    }
                })
                {
                    IsBackground =
                        true
                };

            thread.SetApartmentState(
                ApartmentState.STA);

            thread.Start();

            if (!ready.Wait(
                    TimeSpan.FromSeconds(5)))
            {
                _startupForm =
                    null;
            }
        }

        public static void SetStartupProgress(
            int value,
            string message)
        {
            var form =
                _startupForm;

            if (form == null ||
                form.IsDisposed)
            {
                return;
            }

            try
            {
                form.BeginInvoke(
                    (MethodInvoker)(() =>
                    {
                        form._progress.Value =
                            System.Math.Clamp(
                                value,
                                0,
                                100);

                        form._status.ForeColor =
                            TextSecondary;

                        form._status.Text =
                            message;
                    }));
            }
            catch (InvalidOperationException)
            {
            }
        }

        public static void SetStartupOffline(
            string message)
        {
            var form =
                _startupForm;

            if (form == null ||
                form.IsDisposed)
            {
                return;
            }

            try
            {
                form.BeginInvoke(
                    (MethodInvoker)(() =>
                    {
                        form._progress.Value =
                            0;

                        form._status.ForeColor =
                            Color.FromArgb(
                                235,
                                86,
                                86);

                        form._status.Text =
                            message;
                    }));
            }
            catch (InvalidOperationException)
            {
            }
        }

        public static void CloseStartup()
        {
            var form =
                _startupForm;

            if (form == null ||
                form.IsDisposed)
            {
                return;
            }

            try
            {
                form.BeginInvoke(
                    (MethodInvoker)
                    form.Close);
            }
            catch (InvalidOperationException)
            {
            }
        }

        // ============================================================
        // HELPERS
        // ============================================================

        private void EnableDrag(
            Control control)
        {
            control.MouseDown +=
                (_, e) =>
                {
                    if (e.Button !=
                        MouseButtons.Left)
                    {
                        return;
                    }

                    ReleaseCapture();

                    SendMessage(
                        Handle,
                        0xA1,
                        0x2,
                        0);
                };
        }

        private void ApplyRoundedRegion()
        {
            if (Width <= 0 ||
                Height <= 0)
            {
                return;
            }

            using var path =
                CreateRoundedPath(
                    new Rectangle(
                        0,
                        0,
                        Width,
                        Height),
                    22);

            Region =
                new Region(
                    path);
        }

        private static GraphicsPath CreateRoundedPath(
            Rectangle rect,
            int radius)
        {
            var path =
                new GraphicsPath();

            int diameter =
                radius * 2;

            path.AddArc(
                rect.Left,
                rect.Top,
                diameter,
                diameter,
                180,
                90);

            path.AddArc(
                rect.Right - diameter,
                rect.Top,
                diameter,
                diameter,
                270,
                90);

            path.AddArc(
                rect.Right - diameter,
                rect.Bottom - diameter,
                diameter,
                diameter,
                0,
                90);

            path.AddArc(
                rect.Left,
                rect.Bottom - diameter,
                diameter,
                diameter,
                90,
                90);

            path.CloseFigure();

            return path;
        }

        private static Font FontOf(
            float size,
            FontStyle style)
        {
            try
            {
                return new Font(
                    "Bahnschrift",
                    size,
                    style,
                    GraphicsUnit.Point);
            }
            catch
            {
                return new Font(
                    "Segoe UI",
                    size,
                    style,
                    GraphicsUnit.Point);
            }
        }

        [DllImport("user32.dll")]
        private static extern bool ReleaseCapture();

        [DllImport("user32.dll")]
        private static extern IntPtr SendMessage(
            IntPtr hWnd,
            int msg,
            int wParam,
            int lParam);
    }

    // ================================================================
    // BACKGROUND CANVAS
    // ================================================================

    internal sealed class LoaderBackgroundCanvas : Panel
    {
        private Image? _artwork;

        [DesignerSerializationVisibility(
            DesignerSerializationVisibility.Hidden)]
        public Image? Artwork
        {
            get =>
                _artwork;

            set
            {
                _artwork?.Dispose();

                _artwork =
                    value;

                Invalidate();
            }
        }

        public LoaderBackgroundCanvas()
        {
            SetStyle(
                ControlStyles.AllPaintingInWmPaint |
                ControlStyles.UserPaint |
                ControlStyles.OptimizedDoubleBuffer |
                ControlStyles.ResizeRedraw,
                true);

            BackColor =
                Color.FromArgb(
                    7,
                    7,
                    8);
        }

        protected override void OnPaint(
            PaintEventArgs e)
        {
            e.Graphics.SmoothingMode =
                SmoothingMode.AntiAlias;

            e.Graphics.InterpolationMode =
                InterpolationMode.HighQualityBicubic;

            e.Graphics.PixelOffsetMode =
                PixelOffsetMode.HighQuality;

            e.Graphics.Clear(
                Color.FromArgb(
                    7,
                    7,
                    8));

            if (_artwork != null)
            {
                const int imageAreaWidth =
                    790;

                Rectangle target =
                    new Rectangle(
                        0,
                        0,
                        imageAreaWidth,
                        Height);

                float scale =
                    System.Math.Max(
                        target.Width /
                        (float)_artwork.Width,

                        target.Height /
                        (float)_artwork.Height);

                int drawWidth =
                    (int)(
                        _artwork.Width *
                        scale);

                int drawHeight =
                    (int)(
                        _artwork.Height *
                        scale);

                int drawX =
                    target.X +
                    (
                        target.Width -
                        drawWidth
                    ) / 2;

                int drawY =
                    target.Y +
                    (
                        target.Height -
                        drawHeight
                    ) / 2;

                e.Graphics.DrawImage(
                    _artwork,

                    new Rectangle(
                        drawX,
                        drawY,
                        drawWidth,
                        drawHeight));
            }

            // Escurecimento geral
            using (var dim =
                   new SolidBrush(
                       Color.FromArgb(
                           36,
                           0,
                           5,
                           6)))
            {
                e.Graphics.FillRectangle(
                    dim,
                    ClientRectangle);
            }

            using (var redWash =
                   new LinearGradientBrush(
                       new Rectangle(
                           0,
                           0,
                           690,
                           Height),

                       Color.FromArgb(
                           80,
                           120,
                           12,
                           7),

                       Color.FromArgb(
                           0,
                           20,
                           7,
                           6),

                       LinearGradientMode.Horizontal))
            {
                e.Graphics.FillRectangle(
                    redWash,
                    0,
                    0,
                    690,
                    Height);
            }

            // Fade da imagem para o fundo.
            // Começa transparente e termina totalmente escuro.
            Rectangle blendRect =
                new Rectangle(
                    330,
                    0,
                    600,
                    Height);

            using (var blend =
                   new LinearGradientBrush(
                       blendRect,

                       Color.FromArgb(
                           0,
                           5,
                           10,
                           11),

                       Color.FromArgb(
                           255,
                           7,
                           7,
                           8),

                       LinearGradientMode.Horizontal))
            {
                e.Graphics.FillRectangle(
                    blend,
                    blendRect);
            }

            // Uniformiza completamente o lado direito
            using (var right =
                   new SolidBrush(
                       Color.FromArgb(
                           232,
                           7,
                           7,
                           8)))
            {
                e.Graphics.FillRectangle(
                    right,
                    875,
                    0,
                    Width - 875,
                    Height);
            }

            // Fade inferior
            Rectangle bottomRect =
                new Rectangle(
                    0,
                    Height - 250,
                    Width,
                    250);

            using (var bottom =
                   new LinearGradientBrush(
                       bottomRect,

                       Color.FromArgb(
                           0,
                           5,
                           10,
                           11),

                       Color.FromArgb(
                           220,
                           7,
                           7,
                           8),

                       LinearGradientMode.Vertical))
            {
                e.Graphics.FillRectangle(
                    bottom,
                    bottomRect);
            }

            // Header
            using (var top =
                   new SolidBrush(
                       Color.FromArgb(
                           175,
                           8,
                           8,
                           9)))
            {
                e.Graphics.FillRectangle(
                    top,
                    0,
                    0,
                    Width,
                    74);
            }

            using (var separator =
                   new Pen(
                       Color.FromArgb(
                           30,
                           255,
                           255,
                           255),
                       1))
            {
                e.Graphics.DrawLine(
                    separator,
                    0,
                    74,
                    Width,
                    74);
            }

            base.OnPaint(e);
        }

        protected override void Dispose(
            bool disposing)
        {
            if (disposing)
            {
                _artwork?.Dispose();
                _artwork = null;
            }

            base.Dispose(disposing);
        }
    }

    // ================================================================
    // BRASA FLAME
    // ================================================================

    internal sealed class BrasaFlame : Control
    {
        [DesignerSerializationVisibility(
            DesignerSerializationVisibility.Hidden)]
        public Color AccentColor { get; set; } =
            Color.FromArgb(
                255,
                55,
                43);

        public BrasaFlame()
        {
            SetStyle(
                ControlStyles.AllPaintingInWmPaint |
                ControlStyles.UserPaint |
                ControlStyles.OptimizedDoubleBuffer |
                ControlStyles.SupportsTransparentBackColor |
                ControlStyles.ResizeRedraw,
                true);

            BackColor =
                Color.Transparent;
        }

        protected override void OnPaint(
            PaintEventArgs e)
        {
            e.Graphics.SmoothingMode =
                SmoothingMode.AntiAlias;

            float sx =
                Width / 100f;

            float sy =
                Height / 120f;

            using var outer =
                new GraphicsPath();

            outer.AddBezier(
                51 * sx, 4 * sy,
                73 * sx, 27 * sy,
                92 * sx, 49 * sy,
                82 * sx, 78 * sy);

            outer.AddBezier(
                82 * sx, 78 * sy,
                75 * sx, 102 * sy,
                55 * sx, 115 * sy,
                50 * sx, 116 * sy);

            outer.AddBezier(
                50 * sx, 116 * sy,
                15 * sx, 103 * sy,
                6 * sx, 77 * sy,
                19 * sx, 52 * sy);

            outer.AddBezier(
                19 * sx, 52 * sy,
                26 * sx, 39 * sy,
                38 * sx, 30 * sy,
                51 * sx, 4 * sy);

            outer.CloseFigure();

            using var gradient =
                new LinearGradientBrush(
                    ClientRectangle,

                    Color.FromArgb(
                        255,
                        87,
                        53),

                    AccentColor,

                    90f);

            e.Graphics.FillPath(
                gradient,
                outer);

            using var cut =
                new GraphicsPath();

            cut.AddBezier(
                50 * sx, 44 * sy,
                66 * sx, 58 * sy,
                69 * sx, 74 * sy,
                57 * sx, 91 * sy);

            cut.AddBezier(
                57 * sx, 91 * sy,
                51 * sx, 99 * sy,
                44 * sx, 104 * sy,
                39 * sx, 108 * sy);

            cut.AddBezier(
                39 * sx, 108 * sy,
                35 * sx, 84 * sy,
                31 * sx, 71 * sy,
                50 * sx, 44 * sy);

            cut.CloseFigure();

            using var cutBrush =
                new SolidBrush(
                    Color.FromArgb(
                        12,
                        9,
                        9));

            e.Graphics.FillPath(
                cutBrush,
                cut);
        }
    }

    // ================================================================
    // PRODUCT CARD
    // ================================================================

    internal sealed class ProductCard : Control
    {
        private bool _selected;
        private bool _available = true;

        [DesignerSerializationVisibility(
            DesignerSerializationVisibility.Hidden)]
        public string ProductTitle { get; set; } =
            string.Empty;

        [DesignerSerializationVisibility(
            DesignerSerializationVisibility.Hidden)]
        public string StatusText { get; set; } =
            string.Empty;

        [DesignerSerializationVisibility(
            DesignerSerializationVisibility.Hidden)]
        public string IconText { get; set; } =
            string.Empty;

        [DesignerSerializationVisibility(
            DesignerSerializationVisibility.Hidden)]
        public Color AccentColor { get; set; } =
            Color.FromArgb(
                255,
                55,
                43);

        [DesignerSerializationVisibility(
            DesignerSerializationVisibility.Hidden)]
        public bool Available
        {
            get =>
                _available;

            set
            {
                _available =
                    value;

                Cursor =
                    value
                        ? Cursors.Hand
                        : Cursors.Default;

                Invalidate();
            }
        }

        [DesignerSerializationVisibility(
            DesignerSerializationVisibility.Hidden)]
        public bool Selected
        {
            get =>
                _selected;

            set
            {
                _selected =
                    value;

                Invalidate();
            }
        }

        public ProductCard()
        {
            SetStyle(
                ControlStyles.AllPaintingInWmPaint |
                ControlStyles.UserPaint |
                ControlStyles.OptimizedDoubleBuffer |
                ControlStyles.ResizeRedraw,
                true);

            BackColor =
                Color.Transparent;

            Cursor =
                Cursors.Hand;
        }

        protected override void OnClick(
            EventArgs e)
        {
            if (!Available)
            {
                return;
            }

            Selected =
                true;

            base.OnClick(e);
        }

        protected override void OnPaint(
            PaintEventArgs e)
        {
            e.Graphics.SmoothingMode =
                SmoothingMode.AntiAlias;

            var rect =
                new Rectangle(
                    1,
                    1,
                    Width - 3,
                    Height - 3);

            using var path =
                Rounded(
                    rect,
                    13);

            using var fill =
                new SolidBrush(
                    Selected
                        ? Color.FromArgb(
                            32,
                            18,
                            17)
                        : Color.FromArgb(
                            18,
                            18,
                            20));

            e.Graphics.FillPath(
                fill,
                path);

            using var border =
                new Pen(
                    Selected
                        ? AccentColor
                        : Color.FromArgb(
                            54,
                            54,
                            58),

                    Selected
                        ? 1.8f
                        : 1f);

            e.Graphics.DrawPath(
                border,
                path);

            var iconRect =
                new Rectangle(
                    18,
                    11,
                    50,
                    50);

            using var iconPath =
                Rounded(
                    iconRect,
                    10);

            using var iconBrush =
                new LinearGradientBrush(
                    iconRect,

                    Available
                        ? Color.FromArgb(
                            255,
                            151,
                            73)
                        : Color.FromArgb(
                            86,
                            86,
                            90),

                    Available
                        ? Color.FromArgb(
                            80,
                            84,
                            132)
                        : Color.FromArgb(
                            48,
                            48,
                            52),

                    45f);

            e.Graphics.FillPath(
                iconBrush,
                iconPath);

            TextRenderer.DrawText(
                e.Graphics,
                IconText,
                new Font(
                    "Segoe UI",
                    IconText.Length > 1
                        ? 10f
                        : 15f,
                    FontStyle.Bold),

                iconRect,

                Available
                    ? Color.FromArgb(
                        15,
                        15,
                        16)
                    : Color.FromArgb(
                        32,
                        32,
                        34),

                TextFormatFlags.HorizontalCenter |
                TextFormatFlags.VerticalCenter);

            TextRenderer.DrawText(
                e.Graphics,
                ProductTitle,
                new Font(
                    "Segoe UI",
                    12.5f,
                    FontStyle.Bold),

                new Rectangle(
                    88,
                    14,
                    Width - 165,
                    27),

                Available
                    ? Color.FromArgb(
                        244,
                        244,
                        244)
                    : Color.FromArgb(
                        112,
                        112,
                        118),

                TextFormatFlags.Left |
                TextFormatFlags.VerticalCenter);

            TextRenderer.DrawText(
                e.Graphics,
                StatusText,
                new Font(
                    "Segoe UI",
                    7.5f,
                    FontStyle.Bold),

                new Rectangle(
                    88,
                    41,
                    Width - 165,
                    18),

                Available
                    ? AccentColor
                    : Color.FromArgb(
                        103,
                        103,
                        108),

                TextFormatFlags.Left |
                TextFormatFlags.VerticalCenter);

            if (Available &&
                Selected)
            {
                int cx =
                    Width - 34;

                int cy =
                    Height / 2;

                using var circle =
                    new SolidBrush(
                        AccentColor);

                e.Graphics.FillEllipse(
                    circle,
                    cx - 12,
                    cy - 12,
                    24,
                    24);

                using var check =
                    new Pen(
                        Color.FromArgb(
                            20,
                            10,
                            9),
                        2.3f)
                    {
                        StartCap =
                            LineCap.Round,

                        EndCap =
                            LineCap.Round
                    };

                e.Graphics.DrawLines(
                    check,

                    new[]
                    {
                        new Point(
                            cx - 6,
                            cy),

                        new Point(
                            cx - 1,
                            cy + 5),

                        new Point(
                            cx + 7,
                            cy - 6)
                    });
            }
            else if (!Available)
            {
                int x =
                    Width - 42;

                int y =
                    Height / 2 - 8;

                using var lockPen =
                    new Pen(
                        Color.FromArgb(
                            78,
                            78,
                            82),
                        2f);

                e.Graphics.DrawArc(
                    lockPen,
                    x + 4,
                    y - 5,
                    14,
                    14,
                    180,
                    180);

                using var lockBrush =
                    new SolidBrush(
                        Color.FromArgb(
                            78,
                            78,
                            82));

                e.Graphics.FillRectangle(
                    lockBrush,
                    x + 2,
                    y + 2,
                    18,
                    15);
            }
        }

        private static GraphicsPath Rounded(
            Rectangle r,
            int radius)
        {
            var p =
                new GraphicsPath();

            int d =
                radius * 2;

            p.AddArc(
                r.Left,
                r.Top,
                d,
                d,
                180,
                90);

            p.AddArc(
                r.Right - d,
                r.Top,
                d,
                d,
                270,
                90);

            p.AddArc(
                r.Right - d,
                r.Bottom - d,
                d,
                d,
                0,
                90);

            p.AddArc(
                r.Left,
                r.Bottom - d,
                d,
                d,
                90,
                90);

            p.CloseFigure();

            return p;
        }
    }

    // ================================================================
    // ROUNDED PANEL
    // ================================================================

    internal sealed class RoundedPanel : Panel
    {
        [DesignerSerializationVisibility(
            DesignerSerializationVisibility.Hidden)]
        public int Radius { get; set; } =
            16;

        [DesignerSerializationVisibility(
            DesignerSerializationVisibility.Hidden)]
        public Color FillColor { get; set; } =
            Color.FromArgb(
                11,
                19,
                21);

        [DesignerSerializationVisibility(
            DesignerSerializationVisibility.Hidden)]
        public Color BorderColor { get; set; } =
            Color.FromArgb(
                36,
                54,
                58);

        [DesignerSerializationVisibility(
            DesignerSerializationVisibility.Hidden)]
        public int BorderWidth { get; set; } =
            1;

        public RoundedPanel()
        {
            // IMPORTANTE:
            // habilita transparência ANTES do BackColor transparente
            SetStyle(
                ControlStyles.AllPaintingInWmPaint |
                ControlStyles.UserPaint |
                ControlStyles.OptimizedDoubleBuffer |
                ControlStyles.SupportsTransparentBackColor |
                ControlStyles.ResizeRedraw,
                true);

            BackColor =
                Color.Transparent;
        }

        protected override void OnPaint(
            PaintEventArgs e)
        {
            e.Graphics.SmoothingMode =
                SmoothingMode.AntiAlias;

            var rect =
                new Rectangle(
                    0,
                    0,
                    Width - 1,
                    Height - 1);

            using var path =
                Rounded(
                    rect,
                    Radius);

            using var fill =
                new SolidBrush(
                    FillColor);

            e.Graphics.FillPath(
                fill,
                path);

            if (BorderWidth > 0)
            {
                using var border =
                    new Pen(
                        BorderColor,
                        BorderWidth);

                e.Graphics.DrawPath(
                    border,
                    path);
            }

            base.OnPaint(e);
        }

        private static GraphicsPath Rounded(
            Rectangle r,
            int radius)
        {
            var p =
                new GraphicsPath();

            int d =
                radius * 2;

            p.AddArc(
                r.Left,
                r.Top,
                d,
                d,
                180,
                90);

            p.AddArc(
                r.Right - d,
                r.Top,
                d,
                d,
                270,
                90);

            p.AddArc(
                r.Right - d,
                r.Bottom - d,
                d,
                d,
                0,
                90);

            p.AddArc(
                r.Left,
                r.Bottom - d,
                d,
                d,
                90,
                90);

            p.CloseFigure();

            return p;
        }
    }

    // ================================================================
    // MODERN TEXTBOX
    // ================================================================

    internal sealed class ModernTextBox : UserControl
    {
        private readonly TextBox _box =
            new();

        private bool _focused;

        [DesignerSerializationVisibility(
            DesignerSerializationVisibility.Hidden)]
        public string PlaceholderText
        {
            get =>
                _box.PlaceholderText;

            set =>
                _box.PlaceholderText =
                    value;
        }

        [DesignerSerializationVisibility(
            DesignerSerializationVisibility.Hidden)]
        public bool UseSystemPasswordChar
        {
            get =>
                _box.UseSystemPasswordChar;

            set =>
                _box.UseSystemPasswordChar =
                    value;
        }

        public ModernTextBox()
        {
            // Transparência habilitada primeiro.
            SetStyle(
                ControlStyles.UserPaint |
                ControlStyles.AllPaintingInWmPaint |
                ControlStyles.OptimizedDoubleBuffer |
                ControlStyles.SupportsTransparentBackColor,
                true);

            BackColor =
                Color.Transparent;

            Cursor =
                Cursors.IBeam;

            _box.BorderStyle =
                BorderStyle.None;

            _box.BackColor =
                Color.FromArgb(
                    23,
                    23,
                    25);

            _box.ForeColor =
                Color.White;

            _box.Font =
                new Font(
                    "Segoe UI",
                    10f);

            _box.Location =
                new Point(
                    19,
                    19);

            Controls.Add(
                _box);

            Resize +=
                (_, _) =>
                {
                    _box.Width =
                        System.Math.Max(
                            1,
                            Width - 38);
                };

            _box.GotFocus +=
                (_, _) =>
                {
                    _focused =
                        true;

                    Invalidate();
                };

            _box.LostFocus +=
                (_, _) =>
                {
                    _focused =
                        false;

                    Invalidate();
                };

            MouseDown +=
                (_, _) =>
                _box.Focus();
        }

        protected override void OnPaint(
            PaintEventArgs e)
        {
            e.Graphics.SmoothingMode =
                SmoothingMode.AntiAlias;

            var rect =
                new Rectangle(
                    0,
                    0,
                    Width - 1,
                    Height - 1);

            using var path =
                Rounded(
                    rect,
                    12);

            using var fill =
                new SolidBrush(
                    Color.FromArgb(
                        19,
                        29,
                        32));

            e.Graphics.FillPath(
                fill,
                path);

            using var border =
                new Pen(
                    _focused
                        ? Color.FromArgb(
                            255,
                            55,
                            43)
                        : Color.FromArgb(
                            55,
                            55,
                            60),

                    _focused
                        ? 1.5f
                        : 1f);

            e.Graphics.DrawPath(
                border,
                path);
        }

        private static GraphicsPath Rounded(
            Rectangle r,
            int radius)
        {
            var p =
                new GraphicsPath();

            int d =
                radius * 2;

            p.AddArc(
                r.Left,
                r.Top,
                d,
                d,
                180,
                90);

            p.AddArc(
                r.Right - d,
                r.Top,
                d,
                d,
                270,
                90);

            p.AddArc(
                r.Right - d,
                r.Bottom - d,
                d,
                d,
                0,
                90);

            p.AddArc(
                r.Left,
                r.Bottom - d,
                d,
                d,
                90,
                90);

            p.CloseFigure();

            return p;
        }
    }

    // ================================================================
    // CHECKBOX
    // ================================================================

    internal sealed class NeonCheckBox : Control
    {
        private bool _checked;

        [DesignerSerializationVisibility(
            DesignerSerializationVisibility.Hidden)]
        public bool Checked
        {
            get =>
                _checked;

            set
            {
                _checked =
                    value;

                Invalidate();
            }
        }

        public NeonCheckBox()
        {
            SetStyle(
                ControlStyles.UserPaint |
                ControlStyles.AllPaintingInWmPaint |
                ControlStyles.OptimizedDoubleBuffer |
                ControlStyles.SupportsTransparentBackColor,
                true);

            BackColor =
                Color.Transparent;

            Cursor =
                Cursors.Hand;

            ForeColor =
                Color.FromArgb(
                    226,
                    234,
                    234);

            Font =
                new Font(
                    "Segoe UI",
                    8.5f);
        }

        protected override void OnClick(
            EventArgs e)
        {
            if (Enabled)
            {
                Checked =
                    !Checked;
            }

            base.OnClick(e);
        }

        protected override void OnPaint(
            PaintEventArgs e)
        {
            e.Graphics.SmoothingMode =
                SmoothingMode.AntiAlias;

            Rectangle box =
                new Rectangle(
                    1,
                    3,
                    17,
                    17);

            using var path =
                Rounded(
                    box,
                    4);

            using var fill =
                new SolidBrush(
                    Checked
                        ? Color.FromArgb(
                            255,
                            55,
                            43)
                        : Color.FromArgb(
                            19,
                            29,
                            32));

            e.Graphics.FillPath(
                fill,
                path);

            using var border =
                new Pen(
                    Checked
                        ? Color.FromArgb(
                            255,
                            112,
                            102)
                        : Color.FromArgb(
                            70,
                            70,
                            74));

            e.Graphics.DrawPath(
                border,
                path);

            if (Checked)
            {
                using var pen =
                    new Pen(
                        Color.White,
                        1.8f)
                    {
                        StartCap =
                            LineCap.Round,

                        EndCap =
                            LineCap.Round
                    };

                e.Graphics.DrawLines(
                    pen,

                    new[]
                    {
                        new Point(
                            5,
                            11),

                        new Point(
                            8,
                            14),

                        new Point(
                            14,
                            7)
                    });
            }

            TextRenderer.DrawText(
                e.Graphics,
                Text,
                Font,

                new Rectangle(
                    27,
                    0,
                    Width - 27,
                    Height),

                Enabled
                    ? ForeColor
                    : Color.FromArgb(
                        90,
                        105,
                        106),

                TextFormatFlags.Left |
                TextFormatFlags.VerticalCenter);
        }

        private static GraphicsPath Rounded(
            Rectangle r,
            int radius)
        {
            var p =
                new GraphicsPath();

            int d =
                radius * 2;

            p.AddArc(
                r.Left,
                r.Top,
                d,
                d,
                180,
                90);

            p.AddArc(
                r.Right - d,
                r.Top,
                d,
                d,
                270,
                90);

            p.AddArc(
                r.Right - d,
                r.Bottom - d,
                d,
                d,
                0,
                90);

            p.AddArc(
                r.Left,
                r.Bottom - d,
                d,
                d,
                90,
                90);

            p.CloseFigure();

            return p;
        }
    }

    // ================================================================
    // GLOW BUTTON
    // ================================================================

    internal sealed class GlowButton : Control
    {
        private bool _hover;
        private bool _pressed;

        [DesignerSerializationVisibility(
            DesignerSerializationVisibility.Hidden)]
        public Color AccentColor { get; set; } =
            Color.FromArgb(
                255,
                55,
                43);

        public GlowButton()
        {
            // Transparência precisa ser habilitada ANTES.
            SetStyle(
                ControlStyles.UserPaint |
                ControlStyles.AllPaintingInWmPaint |
                ControlStyles.OptimizedDoubleBuffer |
                ControlStyles.SupportsTransparentBackColor |
                ControlStyles.ResizeRedraw,
                true);

            BackColor =
                Color.Transparent;

            Cursor =
                Cursors.Hand;

            Font =
                new Font(
                    "Segoe UI",
                    11f,
                    FontStyle.Bold);

            ForeColor =
                Color.White;
        }

        protected override void OnResize(
            EventArgs e)
        {
            base.OnResize(e);

            if (Width <= 0 ||
                Height <= 0)
            {
                return;
            }

            using var path =
                Rounded(
                    new Rectangle(
                        0,
                        0,
                        Width - 1,
                        Height - 1),
                    15);

            Region =
                new Region(path);
        }

        protected override void OnPaintBackground(
            PaintEventArgs pevent)
        {
            // Não desenhar fundo retangular.
            // Isso evita cantos brancos.
        }

        protected override void OnMouseEnter(
            EventArgs e)
        {
            _hover =
                true;

            Invalidate();

            base.OnMouseEnter(e);
        }

        protected override void OnMouseLeave(
            EventArgs e)
        {
            _hover =
                false;

            _pressed =
                false;

            Invalidate();

            base.OnMouseLeave(e);
        }

        protected override void OnMouseDown(
            MouseEventArgs e)
        {
            if (e.Button ==
                MouseButtons.Left)
            {
                _pressed =
                    true;

                Invalidate();
            }

            base.OnMouseDown(e);
        }

        protected override void OnMouseUp(
            MouseEventArgs e)
        {
            _pressed =
                false;

            Invalidate();

            base.OnMouseUp(e);
        }

        protected override void OnPaint(
            PaintEventArgs e)
        {
            e.Graphics.SmoothingMode =
                SmoothingMode.AntiAlias;

            var rect =
                new Rectangle(
                    1,
                    _pressed
                        ? 3
                        : 1,

                    Width - 3,
                    Height - 4);

            using var path =
                Rounded(
                    rect,
                    15);

            Color top =
                _hover
                    ? Color.FromArgb(
                        255,
                        91,
                        58)
                    : Color.FromArgb(
                        255,
                        55,
                        43);

            Color bottom =
                _hover
                    ? Color.FromArgb(
                        225,
                        44,
                        26)
                    : Color.FromArgb(
                        177,
                        25,
                        18);

            if (!Enabled)
            {
                top =
                    Color.FromArgb(
                        82,
                        55,
                        53);

                bottom =
                    Color.FromArgb(
                        55,
                        39,
                        38);
            }

            using (var gradient =
                   new LinearGradientBrush(
                       rect,
                       top,
                       bottom,
                       90f))
            {
                e.Graphics.FillPath(
                    gradient,
                    path);
            }

            using (var border =
                   new Pen(
                       _hover
                           ? Color.FromArgb(
                               170,
                               255,
                               105,
                               88)
                           : Color.FromArgb(
                               105,
                               255,
                               105,
                               88),

                       1.2f))
            {
                e.Graphics.DrawPath(
                    border,
                    path);
            }

            if (_hover &&
                Enabled)
            {
                using var glow =
                    new Pen(
                        Color.FromArgb(
                            90,
                            AccentColor),

                        3f);

                e.Graphics.DrawPath(
                    glow,
                    path);
            }

            TextRenderer.DrawText(
                e.Graphics,
                Text,
                Font,
                rect,

                Enabled
                    ? ForeColor
                    : Color.FromArgb(
                        160,
                        176,
                        172),

                TextFormatFlags.HorizontalCenter |
                TextFormatFlags.VerticalCenter);
        }

        private static GraphicsPath Rounded(
            Rectangle r,
            int radius)
        {
            var p =
                new GraphicsPath();

            int d =
                radius * 2;

            p.AddArc(
                r.Left,
                r.Top,
                d,
                d,
                180,
                90);

            p.AddArc(
                r.Right - d,
                r.Top,
                d,
                d,
                270,
                90);

            p.AddArc(
                r.Right - d,
                r.Bottom - d,
                d,
                d,
                0,
                90);

            p.AddArc(
                r.Left,
                r.Bottom - d,
                d,
                d,
                90,
                90);

            p.CloseFigure();

            return p;
        }
    }

    // ================================================================
    // PROGRESS BAR
    // ================================================================

    internal sealed class ModernProgressBar : Control
    {
        private int _value;

        [DesignerSerializationVisibility(
            DesignerSerializationVisibility.Hidden)]
        public Color AccentColor { get; set; } =
            Color.FromArgb(
                21,
                232,
                169);

        [DesignerSerializationVisibility(
            DesignerSerializationVisibility.Hidden)]
        public int Value
        {
            get =>
                _value;

            set
            {
                _value =
                    System.Math.Clamp(
                        value,
                        0,
                        100);

                Invalidate();
            }
        }

        public ModernProgressBar()
        {
            SetStyle(
                ControlStyles.UserPaint |
                ControlStyles.AllPaintingInWmPaint |
                ControlStyles.OptimizedDoubleBuffer |
                ControlStyles.ResizeRedraw,
                true);
        }

        protected override void OnPaint(
            PaintEventArgs e)
        {
            e.Graphics.SmoothingMode =
                SmoothingMode.AntiAlias;

            Rectangle rect =
                new Rectangle(
                    0,
                    0,
                    Width - 1,
                    Height - 1);

            using var bgPath =
                Rounded(
                    rect,
                    Height / 2);

            using (var bg =
                   new SolidBrush(
                       Color.FromArgb(
                           39,
                           53,
                           57)))
            {
                e.Graphics.FillPath(
                    bg,
                    bgPath);
            }

            if (_value <= 0)
            {
                return;
            }

            int width =
                (int)(
                    Width *
                    (_value / 100f));

            width =
                System.Math.Max(
                    Height,
                    width);

            var progressRect =
                new Rectangle(
                    0,
                    0,
                    width,
                    Height - 1);

            using var progressPath =
                Rounded(
                    progressRect,
                    Height / 2);

            using var gradient =
                new LinearGradientBrush(
                    progressRect,

                    Color.FromArgb(
                        177,
                        25,
                        18),

                    AccentColor,

                    0f);

            e.Graphics.FillPath(
                gradient,
                progressPath);
        }

        private static GraphicsPath Rounded(
            Rectangle r,
            int radius)
        {
            var p =
                new GraphicsPath();

            int d =
                System.Math.Max(
                    2,
                    radius * 2);

            p.AddArc(
                r.Left,
                r.Top,
                d,
                d,
                180,
                90);

            p.AddArc(
                r.Right - d,
                r.Top,
                d,
                d,
                270,
                90);

            p.AddArc(
                r.Right - d,
                r.Bottom - d,
                d,
                d,
                0,
                90);

            p.AddArc(
                r.Left,
                r.Bottom - d,
                d,
                d,
                90,
                90);

            p.CloseFigure();

            return p;
        }
    }

    // ================================================================
    // WINDOW BUTTON
    // ================================================================

    internal sealed class WindowButton : Control
    {
        private bool _hover;

        [DesignerSerializationVisibility(
            DesignerSerializationVisibility.Hidden)]
        public bool IsCloseButton { get; set; }

        public WindowButton()
        {
            // Transparência habilitada antes.
            SetStyle(
                ControlStyles.UserPaint |
                ControlStyles.AllPaintingInWmPaint |
                ControlStyles.OptimizedDoubleBuffer |
                ControlStyles.SupportsTransparentBackColor,
                true);

            BackColor =
                Color.Transparent;

            Cursor =
                Cursors.Hand;

            Font =
                new Font(
                    "Segoe UI",
                    13f);

            ForeColor =
                Color.FromArgb(
                    145,
                    161,
                    166);
        }

        protected override void OnMouseEnter(
            EventArgs e)
        {
            _hover =
                true;

            Invalidate();

            base.OnMouseEnter(e);
        }

        protected override void OnMouseLeave(
            EventArgs e)
        {
            _hover =
                false;

            Invalidate();

            base.OnMouseLeave(e);
        }

        protected override void OnPaint(
            PaintEventArgs e)
        {
            e.Graphics.SmoothingMode =
                SmoothingMode.AntiAlias;

            if (_hover)
            {
                using var fill =
                    new SolidBrush(
                        IsCloseButton
                            ? Color.FromArgb(
                                65,
                                220,
                                70,
                                70)
                            : Color.FromArgb(
                                25,
                                255,
                                255,
                                255));

                e.Graphics.FillEllipse(
                    fill,
                    1,
                    1,
                    Width - 2,
                    Height - 2);
            }

            TextRenderer.DrawText(
                e.Graphics,
                Text,
                Font,
                ClientRectangle,

                _hover
                    ? Color.White
                    : ForeColor,

                TextFormatFlags.HorizontalCenter |
                TextFormatFlags.VerticalCenter);
        }
    }
}