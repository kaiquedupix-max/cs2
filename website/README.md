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


### Planos Cakto

O checkout suporta estes planos:

- 1 dia — R$ 5,90 — `CAKTO_OFFER_ID_1D`
- 7 dias — R$ 9,90 — `CAKTO_OFFER_ID_7D`
- 15 dias — R$ 14,90 — `CAKTO_OFFER_ID_15D`
- 1 mês — R$ 19,90 — `CAKTO_OFFER_ID_30D` (faz fallback para `CAKTO_OFFER_ID`)
- 3 meses — R$ 39,90 — `CAKTO_OFFER_ID_3M`
- 6 meses — R$ 64,90 — `CAKTO_OFFER_ID_6M`
- Lifetime — R$ 100,00 — `CAKTO_OFFER_ID_LIFETIME`

Variáveis comuns obrigatórias:

- `CAKTO_API_CLIENT_ID`
- `CAKTO_API_CLIENT_SECRET`
- `CAKTO_SDK_CLIENT_ID`
- `CAKTO_WEBHOOK_SECRET`
- `CAKTO_PIX_EXPIRES_IN` (opcional)
