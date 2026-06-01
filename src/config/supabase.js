const { createClient } = require("@supabase/supabase-js");

const normalizeSupabaseUrl = (url) => {
  if (!url) return url;
  return url.replace(/\/rest\/v1\/?$/, "").replace(/\/$/, "");
};

const supabaseUrl = normalizeSupabaseUrl(process.env.SUPABASE_URL);
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

let supabase = null;

if (supabaseUrl && supabaseServiceRoleKey) {
  supabase = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

module.exports = supabase;
