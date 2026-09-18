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
