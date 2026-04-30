(function (global) {
  var SUPABASE_URL = 'https://rophctdkxyypernslupv.supabase.co';
  var SUPABASE_ANON_KEY = 'sb_publishable_tgTlqavVFVA2rGVrbDnbwA_yrw3Qqz9';

  if (!global.supabase || !global.supabase.createClient) {
    throw new Error('Supabase client nao carregado.');
  }

  global.SupabaseClient = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true
    }
  });
})(window);
