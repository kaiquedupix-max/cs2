using System.Drawing;
using System.Windows.Forms;

namespace Mac1ota_Menu.Classes
{
    internal sealed class LoaderForm : Form
    {
        private readonly TextBox _username = new();
        private readonly TextBox _password = new();
        private readonly Button _enter = new();
        private readonly ProgressBar _progress = new();
        private readonly Label _status = new();
        private readonly System.Windows.Forms.Timer _timer = new();
        private int _value;
        private static LoaderForm? _startupForm;
        public static bool StartupVisible => _startupForm != null && !_startupForm.IsDisposed;

        public LoaderForm()
        {
            Text = "Mac1ota Menu";
            ClientSize = new Size(460, 310);
            StartPosition = FormStartPosition.CenterScreen;
            FormBorderStyle = FormBorderStyle.FixedSingle;
            MaximizeBox = false;
            BackColor = Color.FromArgb(12, 19, 22);
            ForeColor = Color.White;
            Font = new Font("Segoe UI", 10f);

            var title = new Label
            {
                Text = "MAC1OTA MENU",
                ForeColor = Color.FromArgb(56, 220, 166),
                Font = new Font("Segoe UI Semibold", 20f),
                AutoSize = true,
                Location = new Point(132, 28)
            };
            var subtitle = new Label
            {
                Text = "Loader",
                ForeColor = Color.FromArgb(150, 165, 168),
                AutoSize = true,
                Location = new Point(205, 68)
            };

            _username.PlaceholderText = "Usuário";
            _username.Location = new Point(70, 110);
            _username.Size = new Size(320, 30);
            _username.BackColor = Color.FromArgb(25, 35, 39);
            _username.ForeColor = Color.White;
            _username.BorderStyle = BorderStyle.FixedSingle;

            _password.PlaceholderText = "Senha";
            _password.UseSystemPasswordChar = true;
            _password.Location = new Point(70, 150);
            _password.Size = new Size(320, 30);
            _password.BackColor = Color.FromArgb(25, 35, 39);
            _password.ForeColor = Color.White;
            _password.BorderStyle = BorderStyle.FixedSingle;

            _enter.Text = "Entrar";
            _enter.Location = new Point(70, 195);
            _enter.Size = new Size(320, 36);
            _enter.FlatStyle = FlatStyle.Flat;
            _enter.FlatAppearance.BorderColor = Color.FromArgb(56, 220, 166);
            _enter.BackColor = Color.FromArgb(20, 55, 48);
            _enter.ForeColor = Color.White;
            _enter.Click += (_, _) => BeginLoading();

            _status.Text = "Pronto para iniciar";
            _status.ForeColor = Color.FromArgb(150, 165, 168);
            _status.AutoSize = false;
            _status.TextAlign = ContentAlignment.MiddleCenter;
            _status.Location = new Point(70, 242);
            _status.Size = new Size(320, 20);

            _progress.Location = new Point(70, 268);
            _progress.Size = new Size(320, 8);
            _progress.Style = ProgressBarStyle.Continuous;

            Controls.AddRange([title, subtitle, _username, _password, _enter, _status, _progress]);

            // Autenticação real será conectada depois. Por enquanto, Entrar sempre libera o menu.
            _timer.Interval = 20;
            _timer.Tick += (_, _) =>
            {
                _value = Math.Min(100, _value + 8);
                _progress.Value = _value;
                _status.Text = $"Preparando... {_value}%";
                if (_value < 100) return;
                _timer.Stop();
                DialogResult = DialogResult.OK;
                Close();
            };
        }

        private void BeginLoading()
        {
            _enter.Enabled = false;
            _username.Enabled = false;
            _password.Enabled = false;
            _value = 0;
            _progress.Value = 0;
            _status.Text = "Iniciando Mac1ota Menu...";
            _timer.Start();
        }

        public static bool ShowLogin()
        {
            try
            {
                Application.EnableVisualStyles();
                Application.SetCompatibleTextRenderingDefault(false);
                using var form = new LoaderForm();
                return form.ShowDialog() == DialogResult.OK;
            }
            catch
            {
                return false;
            }
        }

        public static void ShowStartup()
        {
            var ready = new ManualResetEventSlim(false);
            var thread = new Thread(() =>
            {
                try
                {
                    _startupForm = new LoaderForm();
                    _startupForm._timer.Stop();
                    _startupForm._username.Visible = false;
                    _startupForm._password.Visible = false;
                    _startupForm._enter.Visible = false;
                    _startupForm._status.Location = new Point(70, 180);
                    _startupForm._progress.Location = new Point(70, 215);
                    _startupForm._status.Text = "Iniciando Mac1ota Menu...";
                    _startupForm.Shown += (_, _) => ready.Set();
                    Application.Run(_startupForm);
                }
                catch
                {
                    ready.Set();
                }
            })
            {
                IsBackground = true
            };
            thread.SetApartmentState(ApartmentState.STA);
            thread.Start();

            if (!ready.Wait(TimeSpan.FromSeconds(5)))
                _startupForm = null;
        }

        public static void SetStartupProgress(int value, string message)
        {
            var form = _startupForm;
            if (form == null || form.IsDisposed) return;
            try
            {
                form.BeginInvoke((MethodInvoker)(() =>
                {
                    form._progress.Value = Math.Clamp(value, 0, 100);
                    form._status.ForeColor = Color.FromArgb(150, 165, 168);
                    form._status.Text = message;
                }));
            }
            catch (InvalidOperationException) { }
        }

        public static void SetStartupOffline(string message)
        {
            var form = _startupForm;
            if (form == null || form.IsDisposed) return;
            try
            {
                form.BeginInvoke((MethodInvoker)(() =>
                {
                    form._progress.Value = 0;
                    form._status.ForeColor = Color.FromArgb(235, 90, 90);
                    form._status.Text = message;
                }));
            }
            catch (InvalidOperationException) { }
        }

        public static void CloseStartup()
        {
            var form = _startupForm;
            if (form == null || form.IsDisposed) return;
            try
            {
                form.BeginInvoke((MethodInvoker)form.Close);
            }
            catch (InvalidOperationException) { }
        }
    }
}
