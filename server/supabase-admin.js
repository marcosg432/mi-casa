'use strict';

var { createClient } = require('@supabase/supabase-js');
var { config } = require('./config');

var client = null;

function getSupabaseAdmin() {
  if (client) return client;
  if (!config.supabaseUrl || !config.supabaseServiceRoleKey) {
    throw new Error('Supabase não configurado. Defina SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
  }
  if (/supabase\.com\/dashboard/i.test(config.supabaseUrl)) {
    throw new Error(
      'SUPABASE_URL inválida: cole a Project URL (https://SEU_REF.supabase.co), não o link do dashboard.'
    );
  }
  client = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  return client;
}

module.exports = { getSupabaseAdmin: getSupabaseAdmin };
