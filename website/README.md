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
