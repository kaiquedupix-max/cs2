using System.Drawing;
using System.Drawing.Drawing2D;
using System.Windows.Forms;

namespace Mac1ota_Menu.Classes
{
    internal sealed class BrandIconControl : Control
    {
        public BrandIconControl()
        {
            DoubleBuffered =
                true;

            BackColor =
                Color.Transparent;

            Size =
                new Size(
                    40,
                    40);

            SetStyle(
                ControlStyles.SupportsTransparentBackColor |
                ControlStyles.AllPaintingInWmPaint |
                ControlStyles.UserPaint |
                ControlStyles.OptimizedDoubleBuffer,
                true);
        }

        protected override void OnPaint(
            PaintEventArgs e)
        {
            base.OnPaint(
                e);

            Graphics g =
                e.Graphics;

            g.SmoothingMode =
                SmoothingMode.AntiAlias;

            RectangleF bounds =
                new(
                    1,
                    1,
                    Width - 2,
                    Height - 2);

            using var background =
                RoundedRect(
                    bounds,
                    Math.Max(
                        7f,
                        Width * .22f));

            using var bgBrush =
                new SolidBrush(
                    Color.FromArgb(
                        7,
                        16,
                        13));

            g.FillPath(
                bgBrush,
                background);

            float scale =
                Math.Min(
                    Width,
                    Height) /
                128f;

            PointF P(
                float x,
                float y) =>
                new(
                    x * scale,
                    y * scale);

            using var lPath =
                new GraphicsPath();

            lPath.AddPolygon(
                new[]
                {
                    P(31, 23),
                    P(55, 23),
                    P(55, 81),
                    P(97, 81),
                    P(97, 105),
                    P(31, 105)
                });

            using var gradient =
                new LinearGradientBrush(
                    bounds,
                    Color.FromArgb(
                        87,
                        244,
                        193),
                    Color.FromArgb(
                        13,
                        183,
                        127),
                    45f);

            g.FillPath(
                gradient,
                lPath);

            using var accent =
                new SolidBrush(
                    Color.FromArgb(
                        225,
                        249,
                        240));

            g.FillPolygon(
                accent,
                new[]
                {
                    P(58, 23),
                    P(71, 23),
                    P(97, 49),
                    P(80, 66),
                    P(58, 44)
                });
        }

        private static GraphicsPath RoundedRect(
            RectangleF rectangle,
            float radius)
        {
            var path =
                new GraphicsPath();

            float diameter =
                radius * 2f;

            path.AddArc(
                rectangle.Left,
                rectangle.Top,
                diameter,
                diameter,
                180,
                90);

            path.AddArc(
                rectangle.Right - diameter,
                rectangle.Top,
                diameter,
                diameter,
                270,
                90);

            path.AddArc(
                rectangle.Right - diameter,
                rectangle.Bottom - diameter,
                diameter,
                diameter,
                0,
                90);

            path.AddArc(
                rectangle.Left,
                rectangle.Bottom - diameter,
                diameter,
                diameter,
                90,
                90);

            path.CloseFigure();

            return path;
        }
    }
}
