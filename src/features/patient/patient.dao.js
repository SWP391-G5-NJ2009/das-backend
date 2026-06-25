const supabase = require("../../config/supabase");
const AppError = require("../../utils/AppError");

/**
 * Search patients by full_name or phone (case-insensitive partial match).
 * Returns up to 20 results.
 */
async function searchPatients(q) {
  const { data, error } = await supabase
    .from("patient")
    .select("patient_id, full_name, phone, email, birth_date, gender")
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
  work_slot:slot_id (
    schedules:schedule_id (
      work_date,
      dentist:dentist_id (
        full_name
      )
    )
  ),
  appointment_service (
    dental_service:service_id (
      service_name
    )
  ),
  treatment_record!inner (
    diagnosis
  ),
  invoice (
    total_amount
  )
`;

async function findProfileByPhone(phone) {
  return supabase
    .from("patient")
    .select("patient_id, account_id")
    .eq("phone", phone)
    .maybeSingle();
}

async function insertProfile(payload) {
  return supabase
    .from("patient")
    .insert(payload)
    .select(PATIENT_PROFILE_SELECT)
    .single();
}

async function linkProfileAccount(patientId, payload) {
  return supabase
    .from("patient")
    .update(payload)
    .eq("patient_id", patientId)
    .select(PATIENT_PROFILE_SELECT)
    .single();
}

async function findTreatmentHistoryByPatientId(patientId) {
  return supabase
    .from("appointment")
    .select(TREATMENT_HISTORY_SELECT)
    .eq("patient_id", patientId)
    .order("book_time", { ascending: false });
}

module.exports = {
  createPatient,
  searchPatients,
  findProfileByPhone,
  findTreatmentHistoryByPatientId,
  insertProfile,
  linkProfileAccount,
};
