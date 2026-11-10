# Counter-Frame Telegram bot (somente Counter-Frame)

Serviço independente para executar no **Coolify**. O site CS2 não é modificado.

## Incluído

- Menu com botões para Android, iOS (pré-venda), planos, pedidos, **Fotos reais**, **Funções**, cupons, idioma, região, suporte e afiliados.
- Galeria com as capturas reais de gameplay, ESP e Aimbot, além de dois mockups promocionais. Os arquivos ficam em `website/public/media` e precisam estar publicados no serviço do site para que o Telegram possa carregar as fotos.
- Idiomas PT, EN, ES, RU (idioma da conta Telegram e ajuste manual).
- Preços BR: **R$ 4,90 / R$ 12,90 / R$ 21,90 / R$ 35,00**.
- Referências de preços internacionais: **US$ 1,50 / US$ 4,00 / US$ 7,00 / US$ 10,00**.
- Banco de dados Postgres para usuários, indicação, cupons e intents.
- /start aceita `cf_android_d30`, `cf_ios_d30` e `ref_123`.
- Endpoint `GET /health` na porta 3211.
- Comandos adicionais `/paysupport`, `/coupon CODIGO`, `/admincoupon CODIGO PERCENTUAL LIMITE` (somente IDs administradores).

## Importante: pagamentos e entrega

**Este estágio é apenas de navegação e pré-cadastro**. O bot *não aceita Stars, não solicita pagamento nem gera ou entrega chaves*. Para cobrar em Stars é necessário calcular e configurar XTR, receber `successful_payment`, associar o pagamento de forma idempotente a um pedido e integrar a entrega automática/estorno. Os preços USD são referências comerciais, não conversões garantidas para Stars.

## Deploy no Coolify

1. Adicione um **novo serviço** do mesmo repositório com diretório raiz `telegram-bot`. Não substitua o serviço `website`.
2. Build pelo `Dockerfile`; sem domínio público, long polling via Bot API. Healthcheck: `/health`, porta `3211`.
3. Em **Environment Variables / Secrets**, configure `TELEGRAM_BOT_TOKEN` com um **token novo** do @BotFather (revogue o token antigo exposto), `DATABASE_URL` (Postgres) e, se desejar, `TELEGRAM_ADMIN_IDS`. Não copie o token para GitHub.
4. Inicie o serviço e teste /start, /shop, /language, /region, /coupon, /referral e /paysupport.

Não execute duas instâncias com long polling para o mesmo token ao mesmo tempo.
