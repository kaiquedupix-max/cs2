using Microsoft.Win32;
using System.Security.Cryptography;
using System.Text;

namespace Mac1ota_Menu.Classes
{
    internal static class DeviceIdentity
    {
        private static readonly Lazy<string> CachedId =
            new(
                BuildStableId);

        public static string CurrentId =>
            CachedId.Value;

        private static string BuildStableId()
        {
            string machineGuid =
                ReadMachineGuid();

            if (string.IsNullOrWhiteSpace(
                    machineGuid))
            {
                machineGuid =
                    Environment.MachineName +
                    "|" +
                    Environment.OSVersion.VersionString;
            }

            byte[] bytes =
                SHA256.HashData(
                    Encoding.UTF8.GetBytes(
                        "legitbaratinho.xyz|" +
                        machineGuid.Trim()));

            return Convert
                .ToHexString(
                    bytes)
                .ToLowerInvariant();
        }

        private static string ReadMachineGuid()
        {
            try
            {
                using RegistryKey? key =
                    Registry.LocalMachine.OpenSubKey(
                        @"SOFTWARE\Microsoft\Cryptography",
                        false);

                return key
                    ?.GetValue(
                        "MachineGuid")
                    ?.ToString() ??
                    string.Empty;
            }
            catch
            {
                return string.Empty;
            }
        }
    }
}
