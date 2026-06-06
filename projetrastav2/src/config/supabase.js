const { createClient } = require('@supabase/supabase-js');
const config = require('./index');

let supabase = null;
let supabaseAdmin = null;

const initSupabase = () => {
  if (!config.supabase.url || !config.supabase.anonKey) {
    console.warn(
      '[supabase] SUPABASE_URL or SUPABASE_ANON_KEY missing. Database calls will fail until configured.'
    );
    return;
  }

  supabase = createClient(config.supabase.url, config.supabase.anonKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  if (config.supabase.serviceKey) {
    supabaseAdmin = createClient(config.supabase.url, config.supabase.serviceKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  } else {
    console.warn(
      '[supabase] SUPABASE_SERVICE_ROLE_KEY missing. Admin operations will not be available.'
    );
  }

  console.log('[supabase] client initialized');
};

initSupabase();

const getSupabase = () => supabase;
const getSupabaseAdmin = () => supabaseAdmin;

module.exports = { getSupabase, getSupabaseAdmin, initSupabase };
