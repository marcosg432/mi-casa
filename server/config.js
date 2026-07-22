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
  '$2a$12$/eOzygNedzIWJkFiAWfyT.M4Mwi.SjlV7RIb5oTngMEl962VZNV1q';

/**
 * Aceita a Project URL da API (https://xxxx.supabase.co).
 * Se o utilizador colar o link do dashboard, extrai o project ref.
 */
function normalizeSupabaseUrl(raw) {
  var url = String(raw || '').trim().replace(/\/+$/, '');
  if (!url) return '';
  var dash = url.match(/supabase\.com\/dashboard\/project\/([a-z0-9]+)/i);
  if (dash) return 'https://' + dash[1] + '.supabase.co';
  var api = url.match(/^(https?:\/\/[a-z0-9-]+\.supabase\.co)/i);
  if (api) return api[1];
  return url;
}

var config = {
  port: Number(process.env.PORT) || 3014,
  nodeEnv: process.env.NODE_ENV || 'development',
  supabaseUrl: normalizeSupabaseUrl(optional('SUPABASE_URL', '')),
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
  var warnings = [];
  if (!config.supabaseUrl) warnings.push('SUPABASE_URL ausente — reservas podem usar armazenamento local.');
  else if (!/^https:\/\/[a-z0-9-]+\.supabase\.co$/i.test(config.supabaseUrl)) {
    warnings.push('SUPABASE_URL inválida — use a Project URL (https://SEU_REF.supabase.co), não o link do dashboard.');
  }
  if (!config.supabaseServiceRoleKey) warnings.push('SUPABASE_SERVICE_ROLE_KEY ausente.');
  else if (
    !config.supabaseServiceRoleKey.startsWith('eyJ') &&
    !config.supabaseServiceRoleKey.startsWith('sb_secret_')
  ) {
    warnings.push('SUPABASE_SERVICE_ROLE_KEY com formato inesperado — use a service_role / secret key.');
  }
  if (!config.adminPasswordHash) warnings.push('ADMIN_PASSWORD_HASH ausente.');
  if (config.jwtSecret.length < 32) warnings.push('JWT_SECRET deve ter pelo menos 32 caracteres.');
  if (config.isProduction && !config.turnstileSecretKey) {
    warnings.push('TURNSTILE_SECRET_KEY ausente — captcha desativado.');
  }
  warnings.forEach(function (w) {
    console.warn('[config]', w);
  });
}

module.exports = {
  config: config,
  required: required,
  optional: optional,
  assertProductionConfig: assertProductionConfig,
  normalizeSupabaseUrl: normalizeSupabaseUrl
};
