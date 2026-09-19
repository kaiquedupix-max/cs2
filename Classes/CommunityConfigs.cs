using ImGuiNET;
using System.Numerics;
using System.Text.RegularExpressions;

namespace Mac1ota_Menu.Classes
{
    internal static class CommunityConfigs
    {
        private static readonly object Sync =
            new();

        private static List<ClientPortalApi.CommunityConfigSummary> _items =
            new();

        private static long _selectedId;
        private static bool _busy;
        private static bool _loaded;
        private static string _status =
            "Clique em Atualizar para carregar as configs.";

        private static string _shareTitle =
            string.Empty;

        private static string _shareDescription =
            string.Empty;

        private static string? _pendingApplyJson;
        private static string? _pendingApplyFileName;

        public static void Draw()
        {
            ApplyPendingConfig();

            if (!_loaded &&
                !_busy)
            {
                _loaded =
                    true;

                BeginRefresh();
            }

            float available =
                ImGui.GetContentRegionAvail().X;

            float leftWidth =
                System.Math.Max(
                    260f,
                    available * .54f);

            ImGui.BeginChild(
                "CommunityConfigList",
                new Vector2(
                    leftWidth,
                    365),
                ImGuiChildFlags.None);

            ImGui.TextColored(
                new Vector4(
                    .22f,
                    .88f,
                    .67f,
                    1f),
                "CONFIGS DA COMUNIDADE");

            ImGui.SameLine();

            if (ImGui.Button(
                    _busy
                        ? "Aguarde..."
                        : "Atualizar") &&
                !_busy)
            {
                BeginRefresh();
            }

            ImGui.Separator();

            ClientPortalApi.CommunityConfigSummary[] snapshot;

            lock (Sync)
            {
                snapshot =
                    _items.ToArray();
            }

            if (snapshot.Length == 0)
            {
                ImGui.TextDisabled(
                    _busy
                        ? "Carregando..."
                        : "Nenhuma config compartilhada ainda.");
            }

            foreach (ClientPortalApi.CommunityConfigSummary item in snapshot)
            {
                ImGui.PushID(
                    (int)item.Id);

                bool selected =
                    _selectedId ==
                    item.Id;

                if (ImGui.Selectable(
                        item.Title,
                        selected,
                        ImGuiSelectableFlags.None,
                        new Vector2(
                            0,
                            32)))
                {
                    _selectedId =
                        item.Id;
                }

                ImGui.SameLine(
                    leftWidth -
                    125);

                ImGui.TextDisabled(
                    item.Downloads +
                    " downloads");

                ImGui.PopID();
            }

            ImGui.EndChild();

            ImGui.SameLine();

            ImGui.BeginChild(
                "CommunityConfigDetails",
                new Vector2(
                    0,
                    365),
                ImGuiChildFlags.None);

            ClientPortalApi.CommunityConfigSummary? selectedItem =
                snapshot.FirstOrDefault(
                    item =>
                        item.Id ==
                        _selectedId);

            if (selectedItem != null)
            {
                ImGui.TextWrapped(
                    selectedItem.Title);

                ImGui.TextDisabled(
                    "por " +
                    selectedItem.Author);

                ImGui.Spacing();

                ImGui.TextWrapped(
                    string.IsNullOrWhiteSpace(
                        selectedItem.Description)
                        ? "Sem descrição."
                        : selectedItem.Description);

                ImGui.Spacing();
                ImGui.Separator();
                ImGui.Spacing();

                if (ImGui.Button(
                        _busy
                            ? "Aguarde..."
                            : "Baixar e aplicar",
                        new Vector2(
                            -1,
                            34)) &&
                    !_busy)
                {
                    BeginDownloadAndApply(
                        selectedItem);
                }
            }
            else
            {
                ImGui.TextDisabled(
                    "Selecione uma config para ver os detalhes.");
            }

            ImGui.EndChild();

            ImGui.Dummy(
                new Vector2(
                    0,
                    8));

            ImGui.BeginChild(
                "CommunityShare",
                new Vector2(
                    0,
                    205),
                ImGuiChildFlags.None);

            ImGui.TextColored(
                new Vector4(
                    .22f,
                    .88f,
                    .67f,
                    1f),
                "COMPARTILHAR SEU PERFIL");

            string selectedLocal =
                string.IsNullOrWhiteSpace(
                    Configs.SelectedConfig)
                    ? "Nenhum perfil selecionado"
                    : Configs.SelectedConfig;

            ImGui.TextDisabled(
                "Perfil local: " +
                selectedLocal);

            ImGui.SetNextItemWidth(
                -1);

            ImGui.InputTextWithHint(
                "##CommunityTitle",
                "Nome público da config",
                ref _shareTitle,
                48);

            ImGui.SetNextItemWidth(
                -1);

            ImGui.InputTextWithHint(
                "##CommunityDescription",
                "Descrição curta",
                ref _shareDescription,
                180);

            if (ImGui.Button(
                    _busy
                        ? "Aguarde..."
                        : "Compartilhar perfil selecionado",
                    new Vector2(
                        -1,
                        34)) &&
                !_busy)
            {
                BeginPublishSelected();
            }

            ImGui.TextDisabled(
                _status);

            ImGui.EndChild();
        }

        private static void BeginRefresh()
        {
            if (_busy)
            {
                return;
            }

            _busy =
                true;

            _status =
                "Atualizando configs da comunidade...";

            _ =
                Task.Run(
                    async () =>
                    {
                        (bool success,
                         List<ClientPortalApi.CommunityConfigSummary> configs,
                         string message) =
                            await ClientPortalApi
                                .GetCommunityConfigsAsync();

                        lock (Sync)
                        {
                            if (success)
                            {
                                _items =
                                    configs;

                                if (_selectedId ==
                                        0 ||
                                    !_items.Any(
                                        x =>
                                            x.Id ==
                                            _selectedId))
                                {
                                    _selectedId =
                                        _items
                                            .FirstOrDefault()
                                            ?.Id ??
                                        0;
                                }
                            }

                            _status =
                                message;

                            _busy =
                                false;
                        }
                    });
        }

        private static void BeginPublishSelected()
        {
            string selected =
                Configs.SelectedConfig;

            if (string.IsNullOrWhiteSpace(
                    selected))
            {
                _status =
                    "Selecione um perfil local na aba Perfis primeiro.";

                return;
            }

            string fileName =
                selected.EndsWith(
                    ".json",
                    StringComparison.OrdinalIgnoreCase)
                    ? selected
                    : selected +
                      ".json";

            string path =
                Path.Combine(
                    Configs.ConfigDirPath,
                    fileName);

            if (!File.Exists(
                    path))
            {
                _status =
                    "O perfil selecionado não foi encontrado.";

                return;
            }

            string title =
                _shareTitle.Trim();

            if (string.IsNullOrWhiteSpace(
                    title))
            {
                title =
                    Path.GetFileNameWithoutExtension(
                        fileName);
            }

            string description =
                _shareDescription.Trim();

            string json;

            try
            {
                json =
                    File.ReadAllText(
                        path);
            }
            catch
            {
                _status =
                    "Não foi possível ler o perfil local.";

                return;
            }

            _busy =
                true;

            _status =
                "Compartilhando perfil...";

            _ =
                Task.Run(
                    async () =>
                    {
                        (bool success, string message) =
                            await ClientPortalApi
                                .PublishCommunityConfigAsync(
                                    title,
                                    description,
                                    json);

                        _status =
                            message;

                        _busy =
                            false;

                        if (success)
                        {
                            _shareTitle =
                                string.Empty;

                            _shareDescription =
                                string.Empty;

                            BeginRefresh();
                        }
                    });
        }

        private static void BeginDownloadAndApply(
            ClientPortalApi.CommunityConfigSummary item)
        {
            _busy =
                true;

            _status =
                "Baixando " +
                item.Title +
                "...";

            _ =
                Task.Run(
                    async () =>
                    {
                        (bool success,
                         ClientPortalApi.CommunityConfigDetails? config,
                         string message) =
                            await ClientPortalApi
                                .GetCommunityConfigAsync(
                                    item.Id);

                        lock (Sync)
                        {
                            if (success &&
                                config != null)
                            {
                                string safeName =
                                    Regex.Replace(
                                        config.Title,
                                        "[^a-zA-Z0-9._ -]",
                                        "_")
                                    .Trim();

                                if (string.IsNullOrWhiteSpace(
                                        safeName))
                                {
                                    safeName =
                                        "community";
                                }

                                _pendingApplyFileName =
                                    "comunidade-" +
                                    config.Id +
                                    "-" +
                                    safeName +
                                    ".json";

                                _pendingApplyJson =
                                    config.ConfigJson;

                                _status =
                                    "Config baixada. Aplicando...";
                            }
                            else
                            {
                                _status =
                                    message;
                            }

                            _busy =
                                false;
                        }
                    });
        }

        private static void ApplyPendingConfig()
        {
            string? json;
            string? fileName;

            lock (Sync)
            {
                json =
                    _pendingApplyJson;

                fileName =
                    _pendingApplyFileName;

                _pendingApplyJson =
                    null;

                _pendingApplyFileName =
                    null;
            }

            if (string.IsNullOrWhiteSpace(
                    json) ||
                string.IsNullOrWhiteSpace(
                    fileName))
            {
                return;
            }

            try
            {
                Directory.CreateDirectory(
                    Configs.ConfigDirPath);

                string path =
                    Path.Combine(
                        Configs.ConfigDirPath,
                        fileName);

                File.WriteAllText(
                    path,
                    json);

                Configs.SavedConfigs[fileName] =
                    true;

                Configs.SelectedConfig =
                    fileName;

                Configs.LoadConfig(
                    fileName);

                global::Sections.sections.Clear();

                global::Sections.sections =
                    global::Sections.InitializeSections();

                _status =
                    "Config aplicada e salva em Perfis.";
            }
            catch (Exception ex)
            {
                _status =
                    "Falha ao aplicar config: " +
                    ex.Message;
            }
        }
    }
}
