using Mac1ota_Menu.Classes;

// Environment (set by the orchestrator): LB_PORTAL_URL (loopback), E2E_USER, E2E_PASS, E2E_PUB (SPKI base64 of the test CI key),
// E2E_WRONG_PUB (another key), E2E_BASE (work folder).
int failures = 0;
void Check(bool ok, string name, string detail = "")
{
    if (!ok) failures++;
    Console.WriteLine((ok ? "ok   " : "FAIL ") + name + (ok ? "" : " :: " + detail));
}
string Env(string n) => Environment.GetEnvironmentVariable(n) ?? throw new InvalidOperationException("missing " + n);

// ---- optional: real CI artifacts (E2E_ARTIFACTS = folder with <product>/attestation.json, signature.b64, <file>) ----
// Verifies them with the key that ships in the loader (ReleaseTrust), the exact check a user's loader performs.
if (Environment.GetEnvironmentVariable("E2E_ARTIFACTS") is { Length: > 0 } artifacts)
{
    foreach ((string product, string dir) in new[] { ("combatarms", "cabr"), ("cs2", "cs2") })
    {
        string folder = Path.Combine(artifacts, dir);
        string payload = File.ReadAllText(Path.Combine(folder, "attestation.json"));
        string signature = File.ReadAllText(Path.Combine(folder, "signature.b64")).Trim();
        var m = ManifestVerifier.Verify(payload, signature, ReleaseTrust.PublicKeySpkiBase64, product, "1.22", out string err);
        Check(m != null, "CI release of " + product + " verifies with the key embedded in the loader", err);
        if (m != null)
        {
            string hash = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(File.ReadAllBytes(Path.Combine(folder, m.FileName)))).ToLowerInvariant();
            Check(hash == m.Sha256 && new FileInfo(Path.Combine(folder, m.FileName)).Length == m.Size, "attested SHA-256 and size match the CI file (" + m.FileName + " v" + m.Version + ")", hash);
        }
    }
    Console.WriteLine(failures == 0 ? "E2E CI ARTIFACTS: ALL PASSED" : $"E2E CI ARTIFACTS: {failures} FAILED");
    return failures == 0 ? 0 : 1;
}

Check(ClientPortalApi.PortalBaseUrl.StartsWith("http://127.0.0.1") || ClientPortalApi.PortalBaseUrl.StartsWith("http://localhost"), "loader talks to the loopback test server", ClientPortalApi.PortalBaseUrl);
Check(ClientPortalApi.ResolvePortalUrl("https://evil.example/") == ClientPortalApi.ProductionPortalUrl, "a remote LB_PORTAL_URL is ignored (cannot redirect the loader)");
Check(ClientPortalApi.ResolvePortalUrl(null) == ClientPortalApi.ProductionPortalUrl && ClientPortalApi.ResolvePortalUrl("ftp://127.0.0.1/") == ClientPortalApi.ProductionPortalUrl, "no or non-http value -> production URL");

// ---- login + account + catalog (real HTTP, real JSON models) ----
var (loggedIn, loginMessage) = await ClientPortalApi.LoginAsync(Env("E2E_USER"), Env("E2E_PASS"));
Check(loggedIn, "login with username/password and device id", loginMessage);
var account = await ClientPortalApi.RefreshAsync();
Check(account != null && account.User.Username == Env("E2E_USER"), "account refresh");
var catalog = ClientPortalApi.Catalog;
Check(catalog != null && catalog.Count >= 2, "catalog parsed from the server", catalog?.Count.ToString() ?? "null");
var ca = catalog?.FirstOrDefault(p => p.Code == "combatarms");
var cs = catalog?.FirstOrDefault(p => p.Code == "cs2");
Check(ca != null && ca.Name == "Combat Arms Brasil Server" && ca.Glyph == "CA" && ca.License.Status == "active" && ca.CanLaunch && ca.Release?.Version == "1.0.0" && ca.Release.MinLoader == "1.21",
    "combatarms card data: name, glyph, active license, release 1.0.0, minLoader", ca == null ? "null" : $"{ca.Name}|{ca.License.Status}|{ca.Release?.Version}");
Check(cs != null && cs.Launch.Type == "external-exe" && cs.CanLaunch && cs.Release?.Version == "1.0.0", "cs2 reports the standalone payload while a signed one is active", cs == null ? "null" : $"{cs.Launch.Type}|{cs.Release?.Version}");
var expired = catalog?.FirstOrDefault(p => p.Code == "testgame");
Check(expired != null && expired.License.Status == "expired" && !expired.CanLaunch && expired.Release == null, "expired product: listed, not launchable, no release", expired == null ? "null" : expired.License.Status);

// ---- launch through the real client path ----
string baseDir = Path.Combine(Env("E2E_BASE"), "runs-" + Guid.NewGuid().ToString("N")[..6]);
Directory.CreateDirectory(baseDir);
int leftovers(string product) => Directory.Exists(Path.Combine(baseDir, product, "runs")) ? Directory.GetFileSystemEntries(Path.Combine(baseDir, product, "runs")).Length : 0;
var stages = new List<SessionStage>();
var source = new PortalReleaseSource();

var ok1 = await ProductSession.RunAsync(source, "combatarms", Env("E2E_PUB"), "1.21", baseDir, (s, _, _) => stages.Add(s));
Check(ok1.Success && ok1.Version == "1.0.0", "signed release downloaded over HTTP, verified, launched, finished", ok1.ErrorCode + " " + ok1.Message);
Check(stages.Contains(SessionStage.Verify) && stages.Contains(SessionStage.Running) && leftovers("combatarms") == 0, "stages seen and the run folder is gone afterwards");

var bad = await ProductSession.RunAsync(source, "combatarms", Env("E2E_WRONG_PUB"), "1.21", baseDir);
Check(!bad.Success && bad.ErrorCode == "bad_signature" && leftovers("combatarms") == 0, "a loader with a different key refuses the server's release", bad.ErrorCode);

var old = await ProductSession.RunAsync(source, "combatarms", Env("E2E_PUB"), "1.20", baseDir);
Check(!old.Success && old.ErrorCode == "loader_too_old" && leftovers("combatarms") == 0, "loader older than minLoader refuses to run the product", old.ErrorCode);

var cs2Run = await ProductSession.RunAsync(source, "cs2", Env("E2E_PUB"), "1.21", baseDir,
    sessionEnvironment: m => new Dictionary<string, string> { ["LB_SESSION_TOKEN"] = ClientPortalApi.Token ?? "", ["LB_DEVICE_ID"] = DeviceIdentity.CurrentId, ["LB_PRODUCT"] = m.Product, ["LB_PORTAL_URL"] = ClientPortalApi.PortalBaseUrl });
Check(cs2Run.Success && cs2Run.Version == "1.0.0" && leftovers("cs2") == 0, "cs2 payload (not admin) launched with the session hand-off", cs2Run.ErrorCode + " " + cs2Run.Message);

string denied = "";
try { await ProductSession.RunAsync(source, "testgame", Env("E2E_PUB"), "1.21", baseDir); }
catch (ProductAccessException ex) { denied = ex.Message; }
Check(denied.Length > 0 && leftovers("testgame") == 0, "expired license: the server refuses and the client reports it", denied);

Console.WriteLine(failures == 0 ? "E2E CLIENT: ALL PASSED" : $"E2E CLIENT: {failures} FAILED");
return failures == 0 ? 0 : 1;
