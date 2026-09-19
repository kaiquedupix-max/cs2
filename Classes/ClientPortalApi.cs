using System.Net;
using System.Net.Http.Headers;
using System.Net.Http.Json;

namespace Mac1ota_Menu.Classes
{
    internal static class ClientPortalApi
    {
        public const string PortalBaseUrl =
            "https://website-production-ee97.up.railway.app/";

        private static readonly HttpClient Http =
            new()
            {
                BaseAddress =
                    new Uri(
                        PortalBaseUrl),

                Timeout =
                    TimeSpan.FromSeconds(
                        8)
            };

        public static string? Token { get; private set; }

        public static AccountSnapshot? Account { get; private set; }

        public static async Task<(bool Success, string Message)> LoginAsync(
            string identifier,
            string password)
        {
            try
            {
                using HttpResponseMessage response =
                    await Http.PostAsJsonAsync(
                        "api/client/login",

                        new
                        {
                            identifier,
                            password,
                            hwid =
                                DeviceIdentity.CurrentId
                        });

                if (!response.IsSuccessStatusCode)
                {
                    ApiError? error =
                        await response.Content
                            .ReadFromJsonAsync<ApiError>();

                    return (
                        false,

                        error?.Message ??
                        (
                            response.StatusCode ==
                            HttpStatusCode.Unauthorized
                                ? "Usuário/e-mail ou senha incorretos."
                                : "Não foi possível entrar na conta."
                        )
                    );
                }

                ClientLoginResponse? login =
                    await response.Content
                        .ReadFromJsonAsync<ClientLoginResponse>();

                if (login == null ||
                    string.IsNullOrWhiteSpace(
                        login.Token) ||
                    login.Account == null)
                {
                    return (
                        false,
                        "Resposta inválida do servidor."
                    );
                }

                Token =
                    login.Token;

                Account =
                    login.Account;

                return (
                    true,
                    "Conta conectada."
                );
            }
            catch (TaskCanceledException)
            {
                return (
                    false,
                    "O servidor demorou demais para responder."
                );
            }
            catch
            {
                return (
                    false,
                    "Não foi possível conectar ao servidor."
                );
            }
        }

        public static async Task<AccountSnapshot?> RefreshAsync()
        {
            if (string.IsNullOrWhiteSpace(
                    Token))
            {
                return null;
            }

            try
            {
                using var request =
                    new HttpRequestMessage(
                        HttpMethod.Get,
                        "api/client/me");

                request.Headers.Authorization =
                    new AuthenticationHeaderValue(
                        "Bearer",
                        Token);

                request.Headers.Add(
                    "X-Device-ID",
                    DeviceIdentity.CurrentId);

                using HttpResponseMessage response =
                    await Http.SendAsync(
                        request);

                if (!response.IsSuccessStatusCode)
                {
                    return null;
                }

                Account =
                    await response.Content
                        .ReadFromJsonAsync<AccountSnapshot>();

                return Account;
            }
            catch
            {
                return null;
            }
        }

        public static async Task<(bool Success, string Message)> DownloadLatestLoaderAsync(
            string destinationPath)
        {
            if (string.IsNullOrWhiteSpace(
                    Token))
            {
                return (
                    false,
                    "Faça login novamente para atualizar o loader."
                );
            }

            try
            {
                using var request =
                    new HttpRequestMessage(
                        HttpMethod.Get,
                        "api/client/download-loader");

                request.Headers.Authorization =
                    new AuthenticationHeaderValue(
                        "Bearer",
                        Token);

                request.Headers.Add(
                    "X-Device-ID",
                    DeviceIdentity.CurrentId);

                using HttpResponseMessage response =
                    await Http.SendAsync(
                        request,
                        HttpCompletionOption.ResponseHeadersRead);

                if (!response.IsSuccessStatusCode)
                {
                    string message =
                        response.StatusCode ==
                        HttpStatusCode.Forbidden
                            ? "Seu acesso não permite baixar esta atualização."
                            : "Não foi possível baixar a atualização.";

                    return (
                        false,
                        message
                    );
                }

                await using Stream source =
                    await response.Content
                        .ReadAsStreamAsync();

                await using FileStream destination =
                    new(
                        destinationPath,
                        FileMode.Create,
                        FileAccess.Write,
                        FileShare.None);

                await source.CopyToAsync(
                    destination);

                return (
                    true,
                    "Atualização baixada."
                );
            }
            catch (TaskCanceledException)
            {
                return (
                    false,
                    "O download da atualização demorou demais."
                );
            }
            catch (Exception ex)
            {
                return (
                    false,
                    "Falha ao baixar atualização: " +
                    ex.Message
                );
            }
        }

        private static HttpRequestMessage CreateClientRequest(
            HttpMethod method,
            string path)
        {
            var request =
                new HttpRequestMessage(
                    method,
                    path);

            if (!string.IsNullOrWhiteSpace(
                    Token))
            {
                request.Headers.Authorization =
                    new AuthenticationHeaderValue(
                        "Bearer",
                        Token);
            }

            request.Headers.Add(
                "X-Device-ID",
                DeviceIdentity.CurrentId);

            return request;
        }

        public static async Task<(bool Success, List<CommunityConfigSummary> Configs, string Message)>
            GetCommunityConfigsAsync()
        {
            if (string.IsNullOrWhiteSpace(
                    Token))
            {
                return (
                    false,
                    new List<CommunityConfigSummary>(),
                    "Faça login novamente."
                );
            }

            try
            {
                using var request =
                    CreateClientRequest(
                        HttpMethod.Get,
                        "api/client/community-configs");

                using HttpResponseMessage response =
                    await Http.SendAsync(
                        request);

                if (!response.IsSuccessStatusCode)
                {
                    ApiError? error =
                        await response.Content
                            .ReadFromJsonAsync<ApiError>();

                    return (
                        false,
                        new List<CommunityConfigSummary>(),
                        error?.Message ??
                        "Não foi possível carregar as configs."
                    );
                }

                CommunityConfigListResponse? payload =
                    await response.Content
                        .ReadFromJsonAsync<CommunityConfigListResponse>();

                return (
                    true,
                    payload?.Configs ??
                    new List<CommunityConfigSummary>(),
                    "Configs atualizadas."
                );
            }
            catch
            {
                return (
                    false,
                    new List<CommunityConfigSummary>(),
                    "Não foi possível conectar à comunidade."
                );
            }
        }

        public static async Task<(bool Success, CommunityConfigDetails? Config, string Message)>
            GetCommunityConfigAsync(
                long id)
        {
            if (string.IsNullOrWhiteSpace(
                    Token))
            {
                return (
                    false,
                    null,
                    "Faça login novamente."
                );
            }

            try
            {
                using var request =
                    CreateClientRequest(
                        HttpMethod.Get,
                        "api/client/community-configs/" +
                        id);

                using HttpResponseMessage response =
                    await Http.SendAsync(
                        request);

                if (!response.IsSuccessStatusCode)
                {
                    ApiError? error =
                        await response.Content
                            .ReadFromJsonAsync<ApiError>();

                    return (
                        false,
                        null,
                        error?.Message ??
                        "Não foi possível baixar esta config."
                    );
                }

                CommunityConfigDetailsResponse? payload =
                    await response.Content
                        .ReadFromJsonAsync<CommunityConfigDetailsResponse>();

                return (
                    payload?.Config != null,
                    payload?.Config,
                    payload?.Config != null
                        ? "Config baixada."
                        : "Resposta inválida do servidor."
                );
            }
            catch
            {
                return (
                    false,
                    null,
                    "Não foi possível baixar esta config."
                );
            }
        }

        public static async Task<(bool Success, string Message)>
            PublishCommunityConfigAsync(
                string title,
                string description,
                string configJson)
        {
            if (string.IsNullOrWhiteSpace(
                    Token))
            {
                return (
                    false,
                    "Faça login novamente."
                );
            }

            try
            {
                using var request =
                    CreateClientRequest(
                        HttpMethod.Post,
                        "api/client/community-configs");

                request.Content =
                    JsonContent.Create(
                        new
                        {
                            title,
                            description,
                            configJson
                        });

                using HttpResponseMessage response =
                    await Http.SendAsync(
                        request);

                if (!response.IsSuccessStatusCode)
                {
                    ApiError? error =
                        await response.Content
                            .ReadFromJsonAsync<ApiError>();

                    return (
                        false,
                        error?.Message ??
                        "Não foi possível compartilhar esta config."
                    );
                }

                return (
                    true,
                    "Config compartilhada com a comunidade."
                );
            }
            catch
            {
                return (
                    false,
                    "Não foi possível compartilhar esta config."
                );
            }
        }

        public static void Clear()
        {
            Token =
                null;

            Account =
                null;
        }

        internal sealed class ClientLoginResponse
        {
            public string Token { get; set; } =
                string.Empty;

            public AccountSnapshot? Account { get; set; }
        }

        internal sealed class AccountSnapshot
        {
            public AccountUser User { get; set; } =
                new();

            public AccountProduct Product { get; set; } =
                new();

            public ProductStatus Status { get; set; } =
                new();
        }

        internal sealed class AccountUser
        {
            public long Id { get; set; }

            public string Username { get; set; } =
                string.Empty;

            public string Email { get; set; } =
                string.Empty;

            public DateTime CreatedAt { get; set; }
        }

        internal sealed class AccountProduct
        {
            public string Code { get; set; } =
                string.Empty;

            public string Name { get; set; } =
                string.Empty;

            public bool HasAccess { get; set; }

            public string? Plan { get; set; }

            public DateTime? PurchasedAt { get; set; }

            public DateTime? ExpiresAt { get; set; }

            public int DaysRemaining { get; set; }
        }

        internal sealed class ProductStatus
        {
            public string Status { get; set; } =
                "maintenance";

            public string Message { get; set; } =
                string.Empty;
        }

        internal sealed class CommunityConfigListResponse
        {
            public List<CommunityConfigSummary> Configs { get; set; } =
                new();
        }

        internal sealed class CommunityConfigDetailsResponse
        {
            public CommunityConfigDetails? Config { get; set; }
        }

        internal sealed class CommunityConfigSummary
        {
            public long Id { get; set; }

            public string Title { get; set; } =
                string.Empty;

            public string Description { get; set; } =
                string.Empty;

            public string Author { get; set; } =
                string.Empty;

            public long Downloads { get; set; }

            public DateTime CreatedAt { get; set; }
        }

        internal sealed class CommunityConfigDetails :
            CommunityConfigSummary
        {
            public string ConfigJson { get; set; } =
                string.Empty;
        }

        internal sealed class ApiError
        {
            public string Error { get; set; } =
                string.Empty;

            public string Message { get; set; } =
                string.Empty;
        }
    }
}
