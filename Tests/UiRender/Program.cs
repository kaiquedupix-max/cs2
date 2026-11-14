using System.Drawing.Imaging;
using System.Reflection;
using Mac1ota_Menu.Classes;

// Renders ProductSelectionForm for several account/catalog situations and writes one PNG per scenario.
// Also asserts what the user would read on screen (button text, status, category line).
internal static class UiRender
{
    [System.Runtime.InteropServices.DllImport("user32.dll")]
    private static extern IntPtr SendMessage(IntPtr hWnd, uint msg, IntPtr wParam, IntPtr lParam);

    private static int failures;

    private static void Check(bool ok, string name, string detail = "")
    {
        if (!ok) failures++;
        Console.WriteLine((ok ? "ok   " : "FAIL ") + name + (ok ? "" : " :: " + detail));
    }

    private static ClientPortalApi.AccountProduct Owned(string code, string name, bool access, int days, bool lifetime = false) =>
        new() { Code = code, Name = name, HasAccess = access, Plan = access ? "admin" : null, PlanLabel = access ? "admin" : null,
                DaysRemaining = access ? days : 0, Lifetime = lifetime, ExpiresAt = access ? DateTime.UtcNow.AddDays(days) : DateTime.UtcNow.AddDays(-2) };

    private static ClientPortalApi.CatalogProduct Entry(string code, string name, string glyph, string status, string launch, string? version, bool canLaunch, int days) =>
        new() { Code = code, Name = name, Glyph = glyph, Platform = "windows", Launch = new() { Type = launch },
                License = new() { Status = status, Plan = "admin", DaysRemaining = days, ExpiresAt = DateTime.UtcNow.AddDays(days) },
                Release = version == null ? null : new() { Version = version, Size = 1234, Signed = true, MinLoader = "1.21" }, CanLaunch = canLaunch };

    [STAThread]
    private static int Main(string[] args)
    {
        string outDir = args.Length > 0 ? args[0] : Path.Combine(Path.GetTempPath(), "lb-ui");
        Directory.CreateDirectory(outDir);
        System.Windows.Forms.Application.EnableVisualStyles();

        var scenarios = new (string File, string Select, List<ClientPortalApi.AccountProduct> Owned, List<ClientPortalApi.CatalogProduct> Catalog, string Expect, string Category)[]
        {
            ("1_cs2_and_cabr_active.png", "cs2",
                new() { Owned("cs2", "Counter-Strike 2", true, 59), Owned("combatarms", "Combat Arms Brasil Server", true, 29) },
                new() { Entry("cs2", "Counter-Strike 2", "CS", "active", "in-process", null, true, 59), Entry("combatarms", "Combat Arms Brasil Server", "CA", "active", "external-exe", "1.0.0", true, 29) },
                "INICIAR COUNTER-STRIKE 2", "CS • WINDOWS"),
            ("2_cabr_selected.png", "combatarms",
                new() { Owned("cs2", "Counter-Strike 2", true, 59), Owned("combatarms", "Combat Arms Brasil Server", true, 29) },
                new() { Entry("cs2", "Counter-Strike 2", "CS", "active", "in-process", null, true, 59), Entry("combatarms", "Combat Arms Brasil Server", "CA", "active", "external-exe", "1.0.0", true, 29) },
                "INICIAR COMBAT ARMS BRASIL SERVER", "CA • WINDOWS • V1.0.0"),
            ("3_cabr_expired.png", "combatarms",
                new() { Owned("cs2", "Counter-Strike 2", true, 59), Owned("combatarms", "Combat Arms Brasil Server", false, 0) },
                new() { Entry("cs2", "Counter-Strike 2", "CS", "active", "in-process", null, true, 59), Entry("combatarms", "Combat Arms Brasil Server", "CA", "expired", "external-exe", null, false, 0) },
                "INICIAR COMBAT ARMS BRASIL SERVER", "CA • WINDOWS"),
            ("4_cs2_standalone_payload.png", "cs2",
                new() { Owned("cs2", "Counter-Strike 2", true, 10) },
                new() { Entry("cs2", "Counter-Strike 2", "CS", "active", "external-exe", "1.4.0", true, 10) },
                "INICIAR COUNTER-STRIKE 2", "CS • WINDOWS • V1.4.0"),
            ("5_long_name_new_product.png", "newgame",
                new() { Owned("cs2", "Counter-Strike 2", true, 59), Owned("combatarms", "Combat Arms Brasil Server", true, 29), Owned("newgame", "Um Jogo Novo Com Nome Bem Comprido", true, 5) },
                new() { Entry("cs2", "Counter-Strike 2", "CS", "active", "in-process", null, true, 59), Entry("combatarms", "Combat Arms Brasil Server", "CA", "active", "external-exe", "1.0.0", true, 29), Entry("newgame", "Um Jogo Novo Com Nome Bem Comprido", "UN", "active", "external-exe", "2.3.1", true, 5) },
                "INICIAR UM JOGO NOVO COM NOME BEM COMPRIDO", "UN • WINDOWS • V2.3.1"),
        };

        // Old server (no /api/client/catalog): the screen must still work from the plain account snapshot.
        scenarios = scenarios.Append(("6_old_server_no_catalog.png", "combatarms",
            new List<ClientPortalApi.AccountProduct> { Owned("cs2", "Counter-Strike 2", true, 59), Owned("combatarms", "Combat Arms Brasil Server", true, 29) },
            (List<ClientPortalApi.CatalogProduct>)null!,
            "INICIAR COMBAT ARMS BRASIL SERVER", "CA • WINDOWS")).ToArray();

        foreach (var sc in scenarios)
        {
            using var form = new ProductSelectionForm();
            // Shown (network refresh + modal notice) is raised from the message loop, which this test never pumps, so the form
            // can be shown and painted synchronously without side effects.
            form.StartPosition = FormStartPosition.Manual;
            form.Location = new Point(20, 20);
            form.Show();

            typeof(ClientPortalApi).GetProperty("Catalog", BindingFlags.Static | BindingFlags.NonPublic | BindingFlags.Public)!.SetValue(null, sc.Catalog);
            var snapshot = new ClientPortalApi.AccountSnapshot
            {
                User = new() { Username = "Admin", Email = "admin@admin.com" },
                Product = sc.Owned[0], Products = sc.Owned, Status = new() { Status = "online", Message = "Sistema disponível." },
            };
            typeof(ProductSelectionForm).GetField("_selected", BindingFlags.Instance | BindingFlags.NonPublic)!.SetValue(form, sc.Select);
            typeof(ProductSelectionForm).GetMethod("RenderAccount", BindingFlags.Instance | BindingFlags.NonPublic)!.Invoke(form, new object[] { snapshot });
            form.Refresh();

            string Text(string field) => ((Control)typeof(ProductSelectionForm).GetField(field, BindingFlags.Instance | BindingFlags.NonPublic)!.GetValue(form)!).Text;
            Check(Text("_start").Trim().StartsWith(sc.Expect), sc.File + ": start button reads \"" + sc.Expect + "\"", Text("_start"));
            Check(Text("_category") == sc.Category, sc.File + ": category line \"" + sc.Category + "\"", Text("_category"));

            // Taskbar icon: a form without Icon showed the generic blank icon (this screen is the one users reported).
            // The icon Windows really uses for the window is compared with the application icon (a missing Icon falls back
            // to the generic "blank window" icon, which also answers WM_GETICON, so "non-zero" proves nothing).
            static long Sig(Icon ic)
            {
                using Bitmap b = ic.ToBitmap();
                long sum = 0;
                for (int x = 0; x < b.Width; x += 2)
                    for (int y = 0; y < b.Height; y += 2) { Color c = b.GetPixel(x, y); sum += c.R * 3 + c.G * 5 + c.B * 7 + c.A; }
                return sum;
            }
            long appSig = Sig(AppIcon.Get()!);
            bool hasIcon()
            {
                IntPtr h = SendMessage(form.Handle, 0x7F, (IntPtr)1, IntPtr.Zero);
                if (h == IntPtr.Zero) h = SendMessage(form.Handle, 0x7F, (IntPtr)0, IntPtr.Zero);
                return h != IntPtr.Zero && Sig(Icon.FromHandle(h)) == appSig;
            }
            Check(form.Icon != null && hasIcon(), sc.File + ": the window carries the application icon (taskbar)");
            if (sc.File.StartsWith("1_"))
            {
                Icon? keep = form.Icon;
                form.Icon = null;
                Check(!hasIcon(), "control: without Icon the window has none (that was the blank taskbar icon)");
                form.Icon = keep;
            }

            using var bmp = new Bitmap(form.Width, form.Height);
            form.DrawToBitmap(bmp, new Rectangle(0, 0, form.Width, form.Height));
            bmp.Save(Path.Combine(outDir, sc.File), ImageFormat.Png);
        }
        Console.WriteLine(failures == 0 ? "UI RENDER: ALL PASSED -> " + outDir : "UI RENDER: " + failures + " FAILED");
        return failures == 0 ? 0 : 1;
    }
}
