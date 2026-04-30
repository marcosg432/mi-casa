/** PM2 — Hostinger VPS; app ouvindo em 0.0.0.0:3014 (nginx faz proxy para cá) */
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
        NODE_ENV: 'production',
        PORT: 3014
      }
    }
  ]
};
