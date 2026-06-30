const supabase = require("../../config/supabase");

function findClinicInfo() {
  if (!supabase) {
    return {
      data: null,
      error: new Error("Supabase client is not configured."),
    };
  }

  return supabase.from("clinic_info").select("*").limit(1);
}

module.exports = { findClinicInfo };
