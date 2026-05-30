# Deploy na Hostinger (VPS) com PM2 — porta 3014

O site é servido por **Express** (`server.js`) em modo estático. O **PM2** mantém o processo ativo; o **nginx** (portas 80/443) deve fazer **proxy reverso** para `http://127.0.0.1:3014`.

## Aviso sobre a porta 3014

Se já existir outro processo na **3014** (`pm2 list` / `sudo ss -tlnp | grep 3014`), pare ou remova-o antes, ou altere `PORT` em `ecosystem.config.cjs` e no `proxy_pass` do nginx.

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
        proxy_pass http://127.0.0.1:3014;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Depois: `sudo nginx -t` e `sudo systemctl reload nginx`.

---

## HTTPS com nginx + Let's Encrypt (Certbot)

### Pré-requisitos

1. Domínio apontando para o IP da VPS (registro **A** em `@` e `www`).
2. App Node a correr com PM2 na porta **3014**.
3. Portas **80** e **443** abertas no firewall da Hostinger.

### 1. Instalar nginx e Certbot (Ubuntu/Debian na VPS)

```bash
sudo apt update
sudo apt install -y nginx certbot python3-certbot-nginx
sudo systemctl enable nginx
sudo systemctl start nginx
```

### 2. Configuração nginx (HTTP inicial)

Crie o ficheiro do site (substitua `teu-dominio.com`):

```bash
sudo nano /etc/nginx/sites-available/mi-casa
```

Conteúdo:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name teu-dominio.com www.teu-dominio.com;

    location / {
        proxy_pass http://127.0.0.1:3014;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

Ative o site e teste:

```bash
sudo ln -sf /etc/nginx/sites-available/mi-casa /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl reload nginx
```

Verifique no browser: `http://teu-dominio.com` deve abrir o site.

### 3. Obter certificado SSL (Let's Encrypt)

```bash
sudo certbot --nginx -d teu-dominio.com -d www.teu-dominio.com
```

Siga as perguntas (e-mail, aceitar termos). Escolha **redireccionar HTTP → HTTPS** quando o Certbot perguntar.

Renovação automática (já configurada pelo Certbot):

```bash
sudo certbot renew --dry-run
```

### 4. Resultado esperado no nginx

O Certbot altera o ficheiro para algo equivalente a:

```nginx
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name teu-dominio.com www.teu-dominio.com;

    ssl_certificate /etc/letsencrypt/live/teu-dominio.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/teu-dominio.com/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    location / {
        proxy_pass http://127.0.0.1:3014;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

server {
    listen 80;
    listen [::]:80;
    server_name teu-dominio.com www.teu-dominio.com;
    return 301 https://$host$request_uri;
}
```

### 5. Variáveis de ambiente na VPS (obrigatório para cookies seguros)

O cookie de sessão usa `Secure` apenas quando `NODE_ENV=production`. Confirme no `.env` ou `ecosystem.config.cjs`:

```bash
NODE_ENV=production
PORT=3014
```

Recarregue a app:

```bash
pm2 reload mi-casa
```

### 6. Checklist pós-HTTPS

```bash
# Certificado válido
curl -I https://teu-dominio.com

# Cookie Secure no login (após credenciais correctas)
curl -v -X POST https://teu-dominio.com/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"SUA_SENHA"}' 2>&1 | grep -i set-cookie
# Deve conter: Secure; HttpOnly; SameSite=Strict

# Painel protegido
curl -I https://teu-dominio.com/painel.html
# Deve redireccionar 302 para /login.html
```

### Onde cada peça fica

| Componente | Onde | Função |
|---|---|---|
| SSL/TLS | nginx (443) | Termina HTTPS, certificado Let's Encrypt |
| Proxy | nginx → `127.0.0.1:3014` | Encaminha tráfego para Node |
| `X-Forwarded-Proto` | header nginx | Express sabe que o cliente usou HTTPS |
| `trust proxy` | `server.js` | Express confia no IP real do cliente |
| Cookies `Secure` | `server/auth.js` | Activos com `NODE_ENV=production` |
| App Node | PM2 porta 3014 | Não expor 3014 publicamente no firewall |

### Alterações no código para HTTPS

Nenhuma alteração obrigatória além de:

- `NODE_ENV=production` na VPS
- nginx com `proxy_set_header X-Forwarded-Proto $scheme` (já no exemplo)
- `app.set('trust proxy', 1)` em `server.js` (já presente)

**Não aceda ao painel via `http://IP:3014` em produção** — use sempre o domínio HTTPS através do nginx.

---

## Variável de porta

A porta vem de `PORT` no `ecosystem.config.cjs` (3014). Podes sobrepor ao arrancar: `PORT=3015 pm2 start ecosystem.config.cjs` (e ajustar nginx).
