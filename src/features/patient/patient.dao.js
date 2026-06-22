const supabase = require("../../config/supabase");
const AppError = require("../../utils/AppError");

function ensureSupabase() {
  if (!supabase) {
    throw new AppError(
      "Supabase is not configured.",
      500,
      "SUPABASE_NOT_CONFIGURED",
    );
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

const PATIENT_PROFILE_SELECT = `
  patient_id,
  account_id,
  full_name,
  phone,
  email,
  dob,
  gender,
  address,
  medical_history,
  avatar,
  no_show_count,
  account:account_id (
    account_id,
    email,
    username,
    phone,
    status,
    role(role_name)
  )
`.trim();

const TREATMENT_HISTORY_SELECT = `
  appt_id,
  patient_id,
  status,
  book_time,
  total_estimated_amount,
  note,
  work_slot:slot_id (
    slot_config:slot_config_id (
      start_time,
      end_time
    ),
    schedules:schedule_id (
      work_date,
      dentist:dentist_id (
        dentist_id,
        account:account_id (
          username,
          email
        )
      )
    )
  ),
  appointment_service (
    actual_price,
    dental_service:service_id (
      service_id,
      service_name
    )
  ),
  treatment_record!inner (
    record_id,
    diagnosis,
    treatment_note
  ),
  invoice (
    invoice_id,
    total_amount,
    payment_status,
    payment_time
  )
`.trim();

async function findProfileByPatientId(patientId) {
  ensureSupabase();

  return supabase
    .from("patient")
    .select(PATIENT_PROFILE_SELECT)
    .eq("patient_id", patientId)
    .maybeSingle();
}

async function updateProfile(patientId, payload) {
  ensureSupabase();

  return supabase
    .from("patient")
    .update(payload)
    .eq("patient_id", patientId)
    .select(PATIENT_PROFILE_SELECT)
    .single();
}

async function findTreatmentHistoryByPatientId(patientId) {
  ensureSupabase();

  return supabase
    .from("appointment")
    .select(TREATMENT_HISTORY_SELECT)
    .eq("patient_id", patientId)
    .order("book_time", { ascending: false });
}

module.exports = {
  createPatient,
  searchPatients,
  findProfileByPatientId,
  findTreatmentHistoryByPatientId,
  updateProfile,
};
