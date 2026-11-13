using System.Net;
using System.Net.Http.Json;

namespace Mac1ota_Menu.Classes
{
    // IReleaseSource bound to the portal API (authenticated loader session + X-Product header).
    internal sealed class PortalReleaseSource : IReleaseSource
    {
        private sealed class ManifestEnvelope
        {
            public string? Payload { get; set; }
            public string? Signature { get; set; }
        }

        public async Task<(string Payload, string Signature)> GetManifestAsync(string product, CancellationToken ct)
        {
            using HttpRequestMessage request = ClientPortalApi.CreateProductRequest(HttpMethod.Get, "api/client/manifest", product);
            using HttpResponseMessage response = await ClientPortalApi.SendAsync(request, HttpCompletionOption.ResponseContentRead);
            if (response.StatusCode == HttpStatusCode.Forbidden) throw new ProductAccessException("Sua conta não possui acesso ativo a este produto.");
            if (!response.IsSuccessStatusCode) throw new IOException("Versão indisponível no servidor (" + (int)response.StatusCode + ").");
            ManifestEnvelope? body = await response.Content.ReadFromJsonAsync<ManifestEnvelope>(cancellationToken: ct);
            if (string.IsNullOrEmpty(body?.Payload) || string.IsNullOrEmpty(body.Signature)) throw new IOException("Manifesto vazio.");
            return (body.Payload, body.Signature);
        }

        public async Task<Stream> OpenDownloadAsync(string product, CancellationToken ct)
        {
            HttpRequestMessage request = ClientPortalApi.CreateProductRequest(HttpMethod.Get, "api/client/payload", product);
            HttpResponseMessage response = await ClientPortalApi.SendAsync(request, HttpCompletionOption.ResponseHeadersRead);
            if (!response.IsSuccessStatusCode)
            {
                response.Dispose();
                request.Dispose();
                throw new IOException("Não foi possível baixar o produto (" + (int)response.StatusCode + ").");
            }
            return await response.Content.ReadAsStreamAsync(ct);
        }
    }

    internal sealed class ProductAccessException : Exception
    {
        public ProductAccessException(string message) : base(message) { }
    }
}
