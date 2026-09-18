using System.Drawing;
using System.Reflection;

namespace Mac1ota_Menu.Classes
{
    internal static class EmbeddedAssets
    {
        public static Bitmap? LoadBitmap(
            string resourceFileName)
        {
            try
            {
                Assembly assembly =
                    Assembly.GetExecutingAssembly();

                string? resourceName =
                    assembly
                        .GetManifestResourceNames()
                        .FirstOrDefault(
                            name =>
                                name.EndsWith(
                                    "." +
                                    resourceFileName,
                                    StringComparison.OrdinalIgnoreCase) ||
                                name.Equals(
                                    resourceFileName,
                                    StringComparison.OrdinalIgnoreCase));

                if (resourceName == null)
                {
                    return null;
                }

                using Stream? stream =
                    assembly.GetManifestResourceStream(
                        resourceName);

                if (stream == null)
                {
                    return null;
                }

                using var image =
                    Image.FromStream(
                        stream);

                return new Bitmap(
                    image);
            }
            catch
            {
                return null;
            }
        }
    }
}
