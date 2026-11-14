using System.Diagnostics;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Mac1ota_Menu.Classes;

int failures = 0;
void Check(bool ok, string name, string detail = "")
{
    if (!ok) failures++;
    Console.WriteLine((ok ? "ok   " : "FAIL ") + name + (ok ? "" : " :: " + detail));
}

// ---- helpers: a throwaway signer that mirrors the product CI (ECDSA P-256, DER) ----
using ECDsa signer = ECDsa.Create(ECCurve.NamedCurves.nistP256);
string pub = Convert.ToBase64String(signer.ExportSubjectPublicKeyInfo());
(string Payload, string Sig) Sign(object manifest)
{
    string payload = JsonSerializer.Serialize(manifest);
    return (payload, Convert.ToBase64String(signer.SignData(Encoding.UTF8.GetBytes(payload), HashAlgorithmName.SHA256, DSASignatureFormat.Rfc3279DerSequence)));
}
object Manifest(string product, byte[] bytes, string name, bool admin = false, string? shaOverride = null, long? size = null, string? minLoader = null, string version = "1.0.0") => new
{
    schema = 2, product, version, fileName = name, size = size ?? bytes.Length,
    sha256 = shaOverride ?? Convert.ToHexString(SHA256.HashData(bytes)).ToLowerInvariant(),
    launch = new { type = "external-exe", requiresAdmin = admin },
    compat = minLoader == null ? new { minLoader = (string?)null, gameBuild = (string?)null } : new { minLoader = (string?)minLoader, gameBuild = (string?)"VER_BR_15.3" },
};
const string Loader = "1.21";

// ---- attestation verification ----
string fixtureDir = Path.Combine(AppContext.BaseDirectory, "..", "..", "..");
using (JsonDocument fx = JsonDocument.Parse(File.ReadAllText(Path.Combine(fixtureDir, "node-fixture.json"))))
{
    string fxPub = fx.RootElement.GetProperty("publicKeySpki").GetString()!;
    string fxPayload = fx.RootElement.GetProperty("payload").GetString()!;
    string fxSig = fx.RootElement.GetProperty("signature").GetString()!;
    var ok = ManifestVerifier.Verify(fxPayload, fxSig, fxPub, "combatarms", Loader, out string e0);
    Check(ok != null && ok.FileName == "cbr.exe" && ok.Launch.RequiresAdmin && ok.Compat.GameBuild == "VER_BR_15.3", "attestation made by the Node CI tool verifies in .NET (interop)", e0);
    Check(ManifestVerifier.Verify(fxPayload.Replace("1.0.0", "9.9.9"), fxSig, fxPub, "combatarms", Loader, out string e1) == null && e1 == "bad_signature", "tampered payload -> bad_signature", e1);
    Check(ManifestVerifier.Verify(fxPayload, fxSig, pub, "combatarms", Loader, out string e2) == null && e2 == "bad_signature", "signature from another key -> bad_signature", e2);
    Check(ManifestVerifier.Verify(fxPayload, fxSig, fxPub, "cs2", Loader, out string e3) == null && e3 == "wrong_product", "attestation of another product refused", e3);
    Check(ManifestVerifier.Verify(fxPayload, fxSig, "", "combatarms", Loader, out string e4) == null && e4 == "key_missing", "no embedded public key -> key_missing (never trusts unsigned)", e4);
    Check(ManifestVerifier.Verify(fxPayload, "not-base64!!", fxPub, "combatarms", Loader, out string e5) == null && e5 == "bad_signature", "garbage signature -> bad_signature", e5);
}
byte[] probe = new byte[] { 1, 2, 3 };
foreach ((string label, string name) in new[] { ("path traversal", "..\\evil.exe"), ("subfolder", "a/b.exe"), ("hidden", ".x.exe") })
{
    var (p, s) = Sign(Manifest("cs2", probe, name));
    Check(ManifestVerifier.Verify(p, s, pub, "cs2", Loader, out string e) == null && e == "bad_file", "signed attestation with unsafe file name refused: " + label, e);
}
{
    var (p, s) = Sign(Manifest("cs2", probe, "x.exe", shaOverride: "zz"));
    Check(ManifestVerifier.Verify(p, s, pub, "cs2", Loader, out string e) == null && e == "bad_file", "signed attestation with malformed SHA-256 refused", e);
    var (p2, s2) = Sign(Manifest("cs2", probe, "x.exe", version: "latest"));
    Check(ManifestVerifier.Verify(p2, s2, pub, "cs2", Loader, out string e2) == null && e2 == "bad_manifest", "signed attestation with malformed version refused", e2);
}

// ---- compatibility: minimum loader version ----
{
    var (p, s) = Sign(Manifest("cs2", probe, "x.exe", minLoader: "1.22"));
    Check(ManifestVerifier.Verify(p, s, pub, "cs2", "1.21", out string e) == null && e == "loader_too_old", "product needing a newer loader is refused", e);
    Check(ManifestVerifier.Verify(p, s, pub, "cs2", "1.22", out _) != null, "same loader version accepted");
    Check(ManifestVerifier.Verify(p, s, pub, "cs2", "2.0", out _) != null, "newer loader accepted");
    var (p2, s2) = Sign(Manifest("cs2", probe, "x.exe", minLoader: "1.9"));
    Check(ManifestVerifier.Verify(p2, s2, pub, "cs2", "1.10", out _) != null, "versions compare numerically (1.10 >= 1.9)");
    Check(ManifestVerifier.CompareVersions("1.10", "1.9") > 0 && ManifestVerifier.CompareVersions("1.0", "1.0.0") == 0 && ManifestVerifier.CompareVersions("1.2.3", "1.2.4") < 0, "version comparison");
}

// ---- session lifecycle ----
string baseDir = Path.Combine(Path.GetTempPath(), "lb-platform-checks-" + Guid.NewGuid().ToString("N"));
Directory.CreateDirectory(baseDir);
string runs(string product) => Path.Combine(baseDir, product, "runs");
int leftovers(string product) => Directory.Exists(runs(product)) ? Directory.GetFileSystemEntries(runs(product)).Length : 0;

string exePath = Path.Combine(Environment.SystemDirectory, "whoami.exe");
byte[] exe = File.ReadAllBytes(exePath);

var good = Sign(Manifest("cs2", exe, "whoami.exe"));
var stages = new List<SessionStage>();
var r1 = await ProductSession.RunAsync(new FakeSource(good, exe), "cs2", pub, Loader, baseDir, (st, _, _) => stages.Add(st));
Check(r1.Success && r1.Version == "1.0.0", "happy path: download, verify, launch, wait", r1.Message);
Check(stages.Contains(SessionStage.Verify) && stages.Last() == SessionStage.Cleanup, "stages reported in order");
Check(leftovers("cs2") == 0, "workspace removed after the product exits");

byte[] flipped = (byte[])exe.Clone(); flipped[flipped.Length / 2] ^= 0xFF;
var r2 = await ProductSession.RunAsync(new FakeSource(good, flipped), "cs2", pub, Loader, baseDir);
Check(!r2.Success && r2.ErrorCode == "hash_mismatch" && leftovers("cs2") == 0, "corrupted download: refused, nothing launched, nothing left", r2.ErrorCode);

var r3 = await ProductSession.RunAsync(new FakeSource(good, exe, failAfter: 5000), "cs2", pub, Loader, baseDir);
Check(!r3.Success && r3.ErrorCode == "io_error" && leftovers("cs2") == 0, "interrupted download: error reported, partial file removed", r3.ErrorCode);

var r4 = await ProductSession.RunAsync(new FakeSource(good, exe[..(exe.Length / 2)]), "cs2", pub, Loader, baseDir);
Check(!r4.Success && r4.ErrorCode == "size_mismatch" && leftovers("cs2") == 0, "truncated download refused", r4.ErrorCode);

var r5 = await ProductSession.RunAsync(new FakeSource(good, exe), "cs2", "", Loader, baseDir);
Check(!r5.Success && r5.ErrorCode == "key_missing" && leftovers("cs2") == 0, "no trust anchor: nothing downloaded or run", r5.ErrorCode);

var wrongProduct = Sign(Manifest("combatarms", exe, "whoami.exe"));
var r6 = await ProductSession.RunAsync(new FakeSource(wrongProduct, exe), "cs2", pub, Loader, baseDir);
Check(!r6.Success && r6.ErrorCode == "wrong_product", "server answering with another product's attestation is refused", r6.ErrorCode);

var tooNew = Sign(Manifest("cs2", exe, "whoami.exe", minLoader: "9.0"));
var src7 = new FakeSource(tooNew, exe);
var r7 = await ProductSession.RunAsync(src7, "cs2", pub, Loader, baseDir);
Check(!r7.Success && r7.ErrorCode == "loader_too_old" && !src7.Downloaded && leftovers("cs2") == 0, "incompatible release is rejected before any download", r7.ErrorCode);

// ---- cleanup rules ----
string userData = Path.Combine(baseDir, "cs2", "settings.json");
File.WriteAllText(userData, "{}");
string foreign = Path.Combine(runs("cs2"), "not-ours"); Directory.CreateDirectory(foreign); File.WriteAllText(Path.Combine(foreign, "keep.txt"), "x");
string stale = Path.Combine(runs("cs2"), "stale"); Directory.CreateDirectory(stale);
File.WriteAllText(Path.Combine(stale, ".lb-workspace"), "cs2"); File.WriteAllText(Path.Combine(stale, "owner.lock"), ""); File.WriteAllText(Path.Combine(stale, "a.exe.part"), "x");
using (ReleaseWorkspace live = ReleaseWorkspace.Create(baseDir, "cs2"))
{
    int swept = ReleaseWorkspace.SweepOrphans(baseDir, "cs2");
    Check(swept == 1 && !Directory.Exists(stale), "crash leftovers (marker, no live owner) are swept", swept.ToString());
    Check(Directory.Exists(live.Directory), "a live run's workspace is never swept");
    Check(File.Exists(Path.Combine(foreign, "keep.txt")), "folders without our marker are never touched");
    Check(File.Exists(userData), "user data next to the runs folder is never touched");
}
{
    ReleaseWorkspace busy = ReleaseWorkspace.Create(baseDir, "cs2");
    string busyDir = busy.Directory;
    var handle = new FileStream(Path.Combine(busyDir, "busy.exe"), FileMode.Create, FileAccess.Write, FileShare.None);
    busy.Dispose();
    Check(Directory.Exists(busyDir), "files still in use are not deleted");
    handle.Dispose();
    Check(ReleaseWorkspace.SweepOrphans(baseDir, "cs2") >= 1 && !Directory.Exists(busyDir), "deferred cleanup succeeds once the file is released");
}

// ---- detach: the loader closes right after the product starts, the product keeps running ----
{
    byte[] cmd = File.ReadAllBytes(Path.Combine(Environment.SystemDirectory, "cmd.exe"));
    var det = Sign(Manifest("cs2", cmd, "cmd.exe"));
    var sw = Stopwatch.StartNew();
    var rd = await ProductSession.RunAsync(new FakeSource(det, cmd), "cs2", pub, Loader, baseDir, detach: true);
    Check(rd.Success && sw.Elapsed < TimeSpan.FromSeconds(20), "detach: returns as soon as the product has started (does not wait for it to exit)", rd.ErrorCode + " " + sw.Elapsed);
    bool running = Process.GetProcessesByName("cmd").Any(p => { try { return p.MainModule?.FileName?.StartsWith(baseDir, StringComparison.OrdinalIgnoreCase) == true; } catch { return false; } });
    Check(running, "detach: the product process is still running after the session returned");
    int owned() => Directory.GetDirectories(runs("cs2")).Count(d => File.Exists(Path.Combine(d, ".lb-workspace")));
    Check(owned() == 1, "detach: its folder is kept while the executable is in use", owned().ToString());
    foreach (var p in Process.GetProcessesByName("cmd")) { try { if (p.MainModule?.FileName?.StartsWith(baseDir, StringComparison.OrdinalIgnoreCase) == true) { p.Kill(); p.WaitForExit(5000); } } catch { } }
    Check(ReleaseWorkspace.SweepOrphans(baseDir, "cs2") >= 1 && owned() == 0, "detach: the next sweep removes the folder once the product has exited", owned().ToString());
}

// ---- launch rules (unit-level: BuildStartInfo only; no process is started here) ----
ReleaseManifest Mf(bool admin) => new() { Schema = 2, Product = "cs2", Version = "1.0.0", Launch = new ManifestLaunch { Type = "external-exe", RequiresAdmin = admin } };
var env = new Dictionary<string, string> { ["LB_SESSION_TOKEN"] = "t" };
var direct = ProductSession.BuildStartInfo(Mf(false), "x.exe", baseDir, env, out string se1);
Check(direct != null && !direct.UseShellExecute && direct.Environment["LB_SESSION_TOKEN"] == "t" && string.IsNullOrEmpty(direct.Arguments), "session hand-off: direct start, token in environment, never on the command line", se1);
var elevated = ProductSession.BuildStartInfo(Mf(true), "x.exe", baseDir, null, out _);
Check(elevated != null && elevated.UseShellExecute && elevated.Verb == "runas", "admin product without hand-off: ShellExecute runas");
Check(ProductSession.BuildStartInfo(Mf(true), "x.exe", baseDir, env, out string se2) == null && se2 == "session_handoff_unavailable_for_admin", "admin product + hand-off refused instead of dropping the session", se2);
var plain = ProductSession.BuildStartInfo(Mf(false), "x.exe", baseDir, null, out _);
Check(plain != null && plain.UseShellExecute && string.IsNullOrEmpty(plain.Verb), "no hand-off, no admin: plain start");

try { Directory.Delete(baseDir, true); } catch { }
Console.WriteLine(failures == 0 ? "PLATFORM LOADER CHECKS: ALL PASSED" : $"PLATFORM LOADER CHECKS: {failures} FAILED");
return failures == 0 ? 0 : 1;

sealed class FakeSource : IReleaseSource
{
    private readonly (string Payload, string Sig) _manifest;
    private readonly byte[] _bytes;
    private readonly int _failAfter;
    public bool Downloaded { get; private set; }
    public FakeSource((string, string) manifest, byte[] bytes, int failAfter = -1) { _manifest = manifest; _bytes = bytes; _failAfter = failAfter; }
    public Task<(string Payload, string Signature)> GetManifestAsync(string product, CancellationToken ct) => Task.FromResult((_manifest.Payload, _manifest.Sig));
    public Task<Stream> OpenDownloadAsync(string product, CancellationToken ct)
    {
        Downloaded = true;
        return Task.FromResult<Stream>(_failAfter < 0 ? new MemoryStream(_bytes) : new FailingStream(_bytes, _failAfter));
    }

    private sealed class FailingStream : MemoryStream
    {
        private readonly int _limit;
        public FailingStream(byte[] b, int limit) : base(b) { _limit = limit; }
        public override ValueTask<int> ReadAsync(Memory<byte> buffer, CancellationToken ct = default)
        {
            if (Position >= _limit) throw new IOException("simulated connection drop");
            return base.ReadAsync(buffer[..Math.Min(buffer.Length, _limit)], ct);
        }
    }
}
