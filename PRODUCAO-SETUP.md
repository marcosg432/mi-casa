# Configuração para produção

## 1. Supabase

1. Crie um projeto em [supabase.com](https://supabase.com).
2. No **SQL Editor**, execute na ordem:
   - `supabase/migrations/001_reservas.sql`
   - `supabase/quartos_catalog.sql`
   - `supabase/migrations/002_producao.sql`
   - `supabase/migrations/003_exclude_overbooking.sql`
3. Copie **Project URL** e **service_role key** (Settings → API).  
   **Nunca** exponha a service_role no front-end.

## 2. Variáveis de ambiente

Copie `.env.example` para `.env` e preencha:

```bash
cp .env.example .env
npm run hash-admin-password
```

Cole o hash gerado em `ADMIN_PASSWORD_HASH`.

## 3. Cloudflare Turnstile

1. Crie um site em [Cloudflare Turnstile](https://dash.cloudflare.com/?to=/:account/turnstile).
2. Defina `TURNSTILE_SITE_KEY` e `TURNSTILE_SECRET_KEY` no `.env`.

## 4. Arranque

```bash
npm install
npm start
```

Painel: `/login.html` → credenciais definidas no `.env`.

## 5. PM2 (VPS)

```bash
npm ci --omit=dev
pm2 start ecosystem.config.cjs
```

Configure as mesmas variáveis no `ecosystem.config.cjs` ou num ficheiro `.env` na VPS.
