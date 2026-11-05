using Mac1ota_Menu.Classes;

namespace Mac1ota_Menu.Modules.Visual;

public class CosmeticLoadout : IModule
{
    // Configs serializes public module fields. Replace lists on edits so the
    // application worker always reads a stable snapshot, including after Load.
    public sealed record Choice(ushort Definition, int Category, int Paint, int Seed, float Wear,
        bool Legacy, string Name, int Rarity, bool StatTrak = false, int Counter = 0);
    public static List<Choice> Choices = new();
    public static bool Automatic = true;
    private static readonly object Gate = new();

    public static void Set(Choice choice)
    {
        _ = SkinMaterialData.Attributes(choice.Paint, choice.Seed, choice.Wear);
        if (choice.Category is < 0 or > 2 || choice.Definition == 0 || choice.Counter < 0)
            throw new ArgumentException("Escolha de cosmético inválida.");
        lock (Gate)
        {
            var updated = (Choices ?? new()).Where(c => c != null &&
                !(c.Category == choice.Category && (choice.Category != 0 || c.Definition == choice.Definition))).ToList();
            updated.Add(choice); Choices = updated;
        }
    }

    public static Choice? Find(int category, ushort definition) => (Choices ?? new())
        .FirstOrDefault(c => c != null && c.Category == category && (category != 0 || c.Definition == definition));
    internal static string DisplayName(int category, ushort definition, string fallback)
    {
        var choice = Find(category, definition);
        return choice?.Definition == definition && !string.IsNullOrWhiteSpace(choice.Name)
            ? choice.Name : fallback;
    }
    public static void Remove(Choice choice)
    { lock (Gate) Choices = (Choices ?? new()).Where(c => c != choice).ToList(); }
}
