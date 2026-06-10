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
        PORT: 3014,
        DISABLE_PANEL_AUTH: '0',
        ADMIN_USERNAME: 'micasasucasaben@gmail.com',
        ADMIN_PASSWORD_HASH:
          '$2a$12$MJBPfqhhw7o5DRWe6s8.c.Hq.iG5f7KxrCB4aGBflh.lbmRsKHYjm'
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 3014,
        DISABLE_PANEL_AUTH: '0',
        ADMIN_USERNAME: 'micasasucasaben@gmail.com',
        ADMIN_PASSWORD_HASH:
          '$2a$12$MJBPfqhhw7o5DRWe6s8.c.Hq.iG5f7KxrCB4aGBflh.lbmRsKHYjm'
      }
    }
  ]
};
