using ImGuiNET;

namespace Mac1ota_Menu.ImGUI.Widgets
{
    internal class Button
    {
        public static void RenderButton(string label, string? id = null, Action? value = null)
        {
            ImGui.PushID(id ?? label);
            if (ImGui.Button(label))
                value?.Invoke();

            ImGui.PopID();
        }
    }
}