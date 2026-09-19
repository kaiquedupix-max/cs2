using System.Security.Cryptography;
using System.Text;
using System.Text.Json;

namespace Mac1ota_Menu.Classes
{
    internal static class RememberedLogin
    {
        private static readonly byte[] Entropy =
            Encoding.UTF8.GetBytes(
                "legitbaratinho.xyz/login/v1");

        private static readonly string Folder =
            Path.Combine(
                Environment.GetFolderPath(
                    Environment.SpecialFolder.LocalApplicationData),
                "legitbaratinho.xyz");

        private static readonly string FilePath =
            Path.Combine(
                Folder,
                "login.dat");

        public static void Save(
            string identifier,
            string password)
        {
            try
            {
                Directory.CreateDirectory(
                    Folder);

                string json =
                    JsonSerializer.Serialize(
                        new LoginData
                        {
                            Identifier =
                                identifier,

                            Password =
                                password
                        });

                byte[] plain =
                    Encoding.UTF8.GetBytes(
                        json);

                byte[] encrypted =
                    ProtectedData.Protect(
                        plain,
                        Entropy,
                        DataProtectionScope.CurrentUser);

                File.WriteAllBytes(
                    FilePath,
                    encrypted);
            }
            catch
            {
            }
        }

        public static bool TryLoad(
            out string identifier,
            out string password)
        {
            identifier =
                string.Empty;

            password =
                string.Empty;

            try
            {
                if (!File.Exists(
                        FilePath))
                {
                    return false;
                }

                byte[] encrypted =
                    File.ReadAllBytes(
                        FilePath);

                byte[] plain =
                    ProtectedData.Unprotect(
                        encrypted,
                        Entropy,
                        DataProtectionScope.CurrentUser);

                LoginData? data =
                    JsonSerializer.Deserialize<LoginData>(
                        plain);

                if (data == null ||
                    string.IsNullOrWhiteSpace(
                        data.Identifier) ||
                    string.IsNullOrEmpty(
                        data.Password))
                {
                    return false;
                }

                identifier =
                    data.Identifier;

                password =
                    data.Password;

                return true;
            }
            catch
            {
                Clear();
                return false;
            }
        }

        public static void Clear()
        {
            try
            {
                if (File.Exists(
                        FilePath))
                {
                    File.Delete(
                        FilePath);
                }
            }
            catch
            {
            }
        }

        private sealed class LoginData
        {
            public string Identifier { get; set; } =
                string.Empty;

            public string Password { get; set; } =
                string.Empty;
        }
    }
}
