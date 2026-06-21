const supabase = require("../../config/supabase");
const AppError = require("../../utils/AppError");

function ensureSupabase() {
  if (!supabase) {
    throw new AppError("Supabase is not configured.", 500, "SUPABASE_NOT_CONFIGURED");
  }
}

/**
 * Search patients by full_name or phone (case-insensitive partial match).
 * Returns up to 20 results.
 */
async function searchPatients(q) {
  ensureSupabase();

  const { data, error } = await supabase
    .from("patient")
    .select("patient_id, full_name, phone, email, dob, gender")
    .or(`full_name.ilike.%${q}%,phone.ilike.%${q}%`)
    .limit(20);

  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  return data || [];
}

/**
 * Create a new patient record (walk-in; no account needed).
 * Only full_name and phone are required.
 */
async function createPatient({ fullName, phone }) {
  ensureSupabase();

  const { data, error } = await supabase
    .from("patient")
    .insert({ full_name: fullName, phone })
    .select("patient_id, full_name, phone")
    .single();

  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  return data;
}

module.exports = { createPatient, searchPatients };
