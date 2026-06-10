'use strict';

require('dotenv').config();

function required(name) {
  var val = process.env[name];
  if (!val || !String(val).trim()) {
    throw new Error('Variável de ambiente obrigatória ausente: ' + name);
  }
  return String(val).trim();
}

function optional(name, fallback) {
  var val = process.env[name];
  if (val == null || String(val).trim() === '') return fallback;
  val = String(val).trim();
  if (
    (val.charAt(0) === '"' && val.charAt(val.length - 1) === '"') ||
    (val.charAt(0) === "'" && val.charAt(val.length - 1) === "'")
  ) {
    val = val.slice(1, -1);
  }
  return val;
}

var DEFAULT_ADMIN_HASH =
  '$2a$12$MJBPfqhhw7o5DRWe6s8.c.Hq.iG5f7KxrCB4aGBflh.lbmRsKHYjm';

var config = {
  port: Number(process.env.PORT) || 3014,
  nodeEnv: process.env.NODE_ENV || 'development',
  supabaseUrl: optional('SUPABASE_URL', ''),
  supabaseServiceRoleKey: optional('SUPABASE_SERVICE_ROLE_KEY', ''),
  jwtSecret: optional('JWT_SECRET', 'dev-local-mi-casa-jwt-secret-2026-min32'),
  adminUsername: optional('ADMIN_USERNAME', 'micasasucasaben@gmail.com'),
  adminPasswordHash: optional('ADMIN_PASSWORD_HASH', DEFAULT_ADMIN_HASH),
  sessionCookieName: optional('SESSION_COOKIE_NAME', 'mcsc_session'),
  sessionMaxAgeMs: Number(process.env.SESSION_MAX_AGE_MS) || 8 * 60 * 60 * 1000,
  turnstileSiteKey: optional('TURNSTILE_SITE_KEY', ''),
  turnstileSecretKey: optional('TURNSTILE_SECRET_KEY', ''),
  isProduction: process.env.NODE_ENV === 'production',
  disablePanelAuth:
    process.env.DISABLE_PANEL_AUTH === '1' || process.env.DISABLE_PANEL_AUTH === 'true'
};

function assertProductionConfig() {
  if (config.disablePanelAuth) return;
  required('SUPABASE_URL');
  required('SUPABASE_SERVICE_ROLE_KEY');
  required('JWT_SECRET');
  required('ADMIN_PASSWORD_HASH');
  if (config.jwtSecret.length < 32) {
    throw new Error('JWT_SECRET deve ter pelo menos 32 caracteres.');
  }
  if (config.isProduction && !config.turnstileSecretKey) {
    throw new Error('TURNSTILE_SECRET_KEY é obrigatória em produção.');
  }
}

module.exports = { config: config, required: required, optional: optional, assertProductionConfig: assertProductionConfig };
