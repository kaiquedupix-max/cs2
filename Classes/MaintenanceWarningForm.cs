using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace Mac1ota_Menu.Classes
{
    internal sealed class MaintenanceWarningForm : Form
    {
        private static readonly Color Bg =
            Color.FromArgb(
                7,
                12,
                11);

        private static readonly Color Panel =
            Color.FromArgb(
                12,
                20,
                18);

        private static readonly Color Amber =
            Color.FromArgb(
                242,
                201,
                76);

        private static readonly Color TextPrimary =
            Color.FromArgb(
                241,
                245,
                243);

        private static readonly Color TextSecondary =
            Color.FromArgb(
                132,
                147,
                141);

        public MaintenanceWarningForm(
            string message)
        {
            SuspendLayout();

            Text =
                "legitbaratinho.xyz — Manutenção";

            ClientSize =
                new Size(
                    560,
                    340);

            StartPosition =
                FormStartPosition.CenterParent;

            FormBorderStyle =
                FormBorderStyle.None;

            BackColor =
                Bg;

            ShowInTaskbar =
                false;

            TopMost =
                true;

            var card =
                new RoundedPanel
                {
                    Parent =
                        this,

                    Location =
                        new Point(
                            12,
                            12),

                    Size =
                        new Size(
                            536,
                            316),

                    Radius =
                        20,

                    FillColor =
                        Panel,

                    BorderColor =
                        Color.FromArgb(
                            67,
                            60,
                            32)
                };

            var iconCircle =
                new Label
                {
                    Parent =
                        card,

                    Text =
                        "!",

                    Font =
                        new Font(
                            "Segoe UI",
                            22f,
                            FontStyle.Bold),

                    ForeColor =
                        Color.FromArgb(
                            20,
                            17,
                            7),

                    BackColor =
                        Amber,

                    TextAlign =
                        ContentAlignment.MiddleCenter,

                    Location =
                        new Point(
                            28,
                            28),

                    Size =
                        new Size(
                            52,
                            52)
                };

            var eyebrow =
                LabelOf(
                    "MODO MANUTENÇÃO",
                    8f,
                    FontStyle.Bold,
                    Amber,
                    101,
                    30);

            eyebrow.Parent =
                card;

            var title =
                LabelOf(
                    "O produto está em manutenção.",
                    18f,
                    FontStyle.Bold,
                    TextPrimary,
                    101,
                    51);

            title.Parent =
                card;

            var body =
                new Label
                {
                    Parent =
                        card,

                    Text =
                        string.IsNullOrWhiteSpace(
                            message)
                            ? "Estamos realizando ajustes no serviço."
                            : message,

                    Font =
                        new Font(
                            "Segoe UI",
                            9.5f,
                            FontStyle.Regular),

                    ForeColor =
                        TextSecondary,

                    BackColor =
                        Color.Transparent,

                    Location =
                        new Point(
                            30,
                            108),

                    Size =
                        new Size(
                            476,
                            53)
                };

            var riskPanel =
                new RoundedPanel
                {
                    Parent =
                        card,

                    Location =
                        new Point(
                            30,
                            171),

                    Size =
                        new Size(
                            476,
                            58),

                    Radius =
                        12,

                    FillColor =
                        Color.FromArgb(
                            31,
                            27,
                            12),

                    BorderColor =
                        Color.FromArgb(
                            83,
                            69,
                            26)
                };

            var risk =
                new Label
                {
                    Parent =
                        riskPanel,

                    Text =
                        "⚠  Se você optar por continuar, o uso é por sua conta e risco.",

                    Font =
                        new Font(
                            "Segoe UI",
                            9f,
                            FontStyle.Bold),

                    ForeColor =
                        Color.FromArgb(
                            247,
                            218,
                            113),

                    BackColor =
                        Color.Transparent,

                    Location =
                        new Point(
                            16,
                            18),

                    AutoSize =
                        true
                };

            var cancel =
                new Button
                {
                    Parent =
                        card,

                    Text =
                        "VOLTAR",

                    FlatStyle =
                        FlatStyle.Flat,

                    BackColor =
                        Color.FromArgb(
                            9,
                            16,
                            14),

                    ForeColor =
                        TextSecondary,

                    Font =
                        new Font(
                            "Segoe UI",
                            8f,
                            FontStyle.Bold),

                    Location =
                        new Point(
                            30,
                            250),

                    Size =
                        new Size(
                            160,
                            43),

                    Cursor =
                        Cursors.Hand,

                    DialogResult =
                        DialogResult.No
                };

            cancel.FlatAppearance.BorderColor =
                Color.FromArgb(
                    41,
                    58,
                    52);

            var proceed =
                new GlowButton
                {
                    Parent =
                        card,

                    Text =
                        "CONTINUAR MESMO ASSIM  →",

                    AccentColor =
                        Amber,

                    Location =
                        new Point(
                            204,
                            250),

                    Size =
                        new Size(
                            302,
                            43)
                };

            proceed.Click +=
                (_, _) =>
                {
                    DialogResult =
                        DialogResult.Yes;

                    Close();
                };

            CancelButton =
                cancel;

            Shown +=
                (_, _) =>
                    ApplyRoundedRegion();

            ResumeLayout(
                false);
        }

        private static Label LabelOf(
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
                    new Font(
                        "Segoe UI",
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

        private void ApplyRoundedRegion()
        {
            using var path =
                new GraphicsPath();

            Rectangle r =
                new(
                    0,
                    0,
                    Width,
                    Height);

            const int d =
                34;

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

        public static bool Confirm(
            IWin32Window owner,
            string message)
        {
            using var form =
                new MaintenanceWarningForm(
                    message);

            return form.ShowDialog(
                       owner) ==
                   DialogResult.Yes;
        }
    }
}
