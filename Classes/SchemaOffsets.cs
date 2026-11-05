using System.Text.RegularExpressions;
namespace Mac1ota_Menu.Classes;
internal static class SchemaOffsets
{
    internal static Dictionary<string, Dictionary<string, int>> Parse(string text)
    {
        var result = new Dictionary<string, Dictionary<string, int>>(StringComparer.Ordinal);
        foreach (Match block in Regex.Matches(text, @"public\s+static\s+class\s+(\w+)\s*\{([^}]*)\}", RegexOptions.CultureInvariant, TimeSpan.FromSeconds(2)))
        {
            var fields = new Dictionary<string, int>(StringComparer.Ordinal);
            foreach (Match member in Regex.Matches(block.Groups[2].Value, @"public const nint ([\w\+]+) = (0x[0-9A-Fa-f]+);", RegexOptions.CultureInvariant, TimeSpan.FromSeconds(1)))
                fields[member.Groups[1].Value] = Convert.ToInt32(member.Groups[2].Value, 16);
            result[block.Groups[1].Value] = fields;
        }
        return result;
    }
}
