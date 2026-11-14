using System.Text;

namespace Mac1ota_Menu.Classes
{
    // Per-run download folder: <base>\<product>\runs\<guid>. Holds an exclusive lock file while its owner is alive,
    // so a crashed run can be recognised and swept later without PID guessing. Only folders carrying our marker file
    // are ever deleted; anything else under the base directory is left alone.
    internal sealed class ReleaseWorkspace : IDisposable
    {
        private const string Marker = ".lb-workspace";
        private const string LockName = "owner.lock";
        private FileStream? _lock;

        public string Directory { get; }

        private ReleaseWorkspace(string directory, FileStream owner)
        {
            Directory = directory;
            _lock = owner;
        }

        private static string RunsRoot(string baseDirectory, string product) => Path.Combine(baseDirectory, product, "runs");

        public static ReleaseWorkspace Create(string baseDirectory, string product)
        {
            string dir = Path.Combine(RunsRoot(baseDirectory, product), Guid.NewGuid().ToString("N"));
            System.IO.Directory.CreateDirectory(dir);
            File.WriteAllText(Path.Combine(dir, Marker), product, Encoding.UTF8);
            var owner = new FileStream(Path.Combine(dir, LockName), FileMode.CreateNew, FileAccess.ReadWrite, FileShare.None);
            return new ReleaseWorkspace(dir, owner);
        }

        // Deletes folders left by runs that no longer hold their lock. Returns how many were removed.
        // A folder whose files are still in use (running executable) is skipped and retried on the next sweep.
        public static int SweepOrphans(string baseDirectory, string product)
        {
            string root = RunsRoot(baseDirectory, product);
            if (!System.IO.Directory.Exists(root)) return 0;
            int removed = 0;
            foreach (string dir in System.IO.Directory.EnumerateDirectories(root))
            {
                if (!File.Exists(Path.Combine(dir, Marker))) continue;
                if ((File.GetAttributes(dir) & FileAttributes.ReparsePoint) != 0) continue;
                try
                {
                    string lockPath = Path.Combine(dir, LockName);
                    if (File.Exists(lockPath))
                    {
                        using var probe = new FileStream(lockPath, FileMode.Open, FileAccess.ReadWrite, FileShare.None);
                    }
                    if (TryDelete(dir)) removed++;
                }
                catch (IOException) { }
                catch (UnauthorizedAccessException) { }
            }
            return removed;
        }

        // Removes the payload first and the marker/lock last: a folder that could not be fully emptied
        // (file in use) keeps its marker, so a later sweep still recognises it as ours.
        private static bool TryDelete(string dir)
        {
            bool clean = true;
            foreach (string entry in System.IO.Directory.EnumerateFileSystemEntries(dir))
            {
                string name = Path.GetFileName(entry);
                if (name == Marker || name == LockName) continue;
                try
                {
                    if (System.IO.Directory.Exists(entry)) System.IO.Directory.Delete(entry, true);
                    else File.Delete(entry);
                }
                catch (IOException) { clean = false; }
                catch (UnauthorizedAccessException) { clean = false; }
            }
            if (!clean) return false;
            try
            {
                File.Delete(Path.Combine(dir, LockName));
                File.Delete(Path.Combine(dir, Marker));
                System.IO.Directory.Delete(dir);
                return true;
            }
            catch (IOException) { return false; }
            catch (UnauthorizedAccessException) { return false; }
        }

        public void Dispose()
        {
            _lock?.Dispose();
            _lock = null;
            for (int attempt = 0; attempt < 5 && System.IO.Directory.Exists(Directory); attempt++)
            {
                if (!TryDelete(Directory)) Thread.Sleep(200);
            }
            // Still locked (product alive): the next SweepOrphans removes it once the product has exited.
        }
    }
}
