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

const PATIENT_PROFILE_SELECT = `
  patient_id,
  account_id,
  full_name,
  phone,
  email,
  birth_date,
  gender,
  address,
  no_show_count,
  account:account_id (
    account_id,
    email,
    username,
    phone,
    status,
    role(role_name)
  )
`;

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
`;

async function findProfileByPatientId(patientId) {
  ensureSupabase();

  return supabase
    .from("patient")
    .select(PATIENT_PROFILE_SELECT)
    .eq("patient_id", patientId)
    .maybeSingle();
}

async function findProfileByPhone(phone) {
  ensureSupabase();

  return supabase
    .from("patient")
    .select("patient_id, account_id")
    .eq("phone", phone)
    .maybeSingle();
}

async function insertProfile(payload) {
  ensureSupabase();

  return supabase
    .from("patient")
    .insert(payload)
    .select(PATIENT_PROFILE_SELECT)
    .single();
}

async function linkProfileAccount(patientId, payload) {
  ensureSupabase();

  return supabase
    .from("patient")
    .update(payload)
    .eq("patient_id", patientId)
    .select(PATIENT_PROFILE_SELECT)
    .single();
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
  findProfileByPatientId,
  findProfileByPhone,
  findTreatmentHistoryByPatientId,
  insertProfile,
  linkProfileAccount,
  updateProfile,
};
