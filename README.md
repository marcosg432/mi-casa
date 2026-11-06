# Mi Casa, Su Casa

Site estático com **Node + Express** para servir ficheiros na VPS (Hostinger) com **PM2**.

## Desenvolvimento local

```bash
npm install
npm start
```

Abre `http://localhost:3014` (ou a `PORT` definida no ambiente).

## Produção (PM2)

```bash
npm ci --omit=dev
npm run pm2:start
```

Ver [DEPLOY-HOSTINGER.md](./DEPLOY-HOSTINGER.md) para nginx, `git pull` e detalhes na Hostinger.

Repositório: [github.com/worldakyra-collab/micasaeu](https://github.com/worldakyra-collab/micasaeu)
