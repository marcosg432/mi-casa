# Deploy na Hostinger (VPS) com PM2 — porta 3013

O site é servido por **Express** (`server.js`) em modo estático. O **PM2** mantém o processo ativo; o **nginx** (portas 80/443) deve fazer **proxy reverso** para `http://127.0.0.1:3013`.

## Aviso sobre a porta 3013

Se já existir outro processo na **3013** (`pm2 list` / `sudo ss -tlnp | grep 3013`), pare ou remova-o antes, ou altere `PORT` em `ecosystem.config.cjs` e no `proxy_pass` do nginx.

## No servidor (SSH)

```bash
cd /var/www   # ou a pasta que preferires
git clone https://github.com/marcosg432/mi-casa.git
cd mi-casa
npm ci --omit=dev
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup   # segue as instruções que o comando imprimir (systemd)
```

Atualizar código depois de um `git pull`:

```bash
cd /caminho/para/mi-casa
git pull
npm ci --omit=dev
pm2 reload mi-casa
```

## Nginx (exemplo)

Substitui `teu-dominio.com` e o caminho do `root` se usares certificados estáticos noutro sítio; o essencial é o `proxy_pass` para a app Node.

```nginx
server {
    listen 80;
    server_name teu-dominio.com www.teu-dominio.com;

    location / {
        proxy_pass http://127.0.0.1:3013;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Depois: `sudo nginx -t` e `sudo systemctl reload nginx`. Para HTTPS, usa Certbot ou o painel da Hostinger.

## Variável de porta

A porta vem de `PORT` no `ecosystem.config.cjs` (3013). Podes sobrepor ao arrancar: `PORT=3014 pm2 start ecosystem.config.cjs` (e ajustar nginx).
