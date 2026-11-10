# legitbaratinho.xyz — website

Site separado do projeto C# principal.

## Variáveis

- `DATABASE_URL`: PostgreSQL.
- `ADMIN_PASSWORD`: senha do painel administrativo.
- `SESSION_SECRET`: segredo longo e aleatório para assinar a sessão.
- `NODE_ENV=production`: recomendado no Railway.

## Desenvolvimento

```bash
cd website
npm install
npm start
```

Admin: `/admin`
Healthcheck: `/health`

### Mercado Pago

O checkout usa o Payment Brick oficial do Mercado Pago com Pix e cartão.

Planos:

- 1 dia — R$ 5,90
- 7 dias — R$ 9,90
- 15 dias — R$ 14,90
- 1 mês — R$ 19,90
- 3 meses — R$ 39,90
- 6 meses — R$ 64,90
- Lifetime — R$ 100,00

Variáveis obrigatórias:

- `MP_PUBLIC_KEY`
- `MP_ACCESS_TOKEN`
- `MP_WEBHOOK_SECRET`
- `PUBLIC_URL=https://legitbaratinho.xyz`

Webhook do Mercado Pago:

`https://legitbaratinho.xyz/api/webhooks/mercadopago`

Habilite notificações de Pagamentos. O acesso só é ativado quando o pagamento fica `approved`.


### Preços Counter-Frame por IP

O CS2 preserva o checkout original. O Counter-Frame usa a geolocalização do IP **no servidor** e não permite trocar a região de compra usando parâmetros da URL ou dados do navegador.

- IP brasileiro reconhecido: 1/7/15/30 dias por R$ 4,90 / R$ 12,90 / R$ 21,90 / R$ 35,00.
- Outros países (ou país não identificado): referência internacional US$ 1,50 / US$ 4 / US$ 7 / US$ 10.
- A conta Mercado Pago brasileira cobra em **BRL**, inclusive cartões estrangeiros. A opção internacional só é habilitada após configurar `CF_USD_BRL_RATE` com o câmbio de cobrança (ex.: `5.20`). O valor final cobrado em BRL aparece claramente no checkout. Sem essa variável, a compra internacional permanece desabilitada para evitar cobranças com preço errado.
- O link Telegram é **exclusivo do Counter-Frame** para catálogo/suporte, sem pagamento pelo bot.

#### Configuração no Coolify

Configure **uma destas opções** para obter o IP real por trás do proxy:

- **Cloudflare:** `GEO_TRUST_CF=true`, com Cloudflare IP Geolocation/visitor headers habilitado; proteja a origem para receber tráfego apenas da Cloudflare. O backend usa `CF-IPCountry` e, quando necessário, `CF-Connecting-IP`.
- **Nginx/Coolify de confiança:** `GEO_TRUST_PROXY=true`, **somente** se o proxy remove/sobrescreve `X-Forwarded-For` de clientes externos. O backend consulta geolocalização via HTTPS a `free.freeipapi.com` com timeout de 2,3 s e cache de 4 h.

Caso nenhuma das opções esteja configurada e a aplicação só veja o IP interno do proxy, a região será classificada como internacional por segurança. A geolocalização de IP pode ser imprecisa (VPN/proxy). Verifique os termos de privacidade do fornecedor antes de disponibilizar o site.
