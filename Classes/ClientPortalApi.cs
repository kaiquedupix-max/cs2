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
                            password
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

        internal sealed class ApiError
        {
            public string Error { get; set; } =
                string.Empty;

            public string Message { get; set; } =
                string.Empty;
        }
    }
}
