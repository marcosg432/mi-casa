/** PM2 — Hostinger VPS; app ouvindo em 0.0.0.0:3014 (nginx faz proxy para cá) */
/** Credenciais do painel: defina ADMIN_USERNAME e ADMIN_PASSWORD_HASH no .env (não aqui). */
module.exports = {
  apps: [
    {
      name: 'mi-casa',
      script: 'server.js',
      cwd: __dirname,
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'development',
        PORT: 3014
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3014
      }
    }
  ]
};
