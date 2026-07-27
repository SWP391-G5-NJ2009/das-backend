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
  book_time,
  status,
  note,
  treatment_plan_id,
  visit_number,
  total_estimated_amount,
  treatment_plan:treatment_plan_id (
    plan_id,
    status,
    created_at,
    completed_at,
    dental_service:service_id (
      service_id,
      service_name
    )
  ),
  appointment_slot (
    is_primary,
    work_slot:slot_id (
      slot_config:slot_config_id (
        start_time,
        end_time
      ),
      schedules:schedule_id (
        work_date,
        dentist:dentist_id (
          dentist_id,
          full_name
        )
      )
    )
  ),
  appointment_service (
    actual_price,
    dental_service:service_id (
      service_name
    )
  ),
  treatment_record!inner (
    record_id,
    treatment_note,
    diagnosis,
    clinical_examination,
    post_treatment_instructions
  ),
  invoice (
    total_amount,
    payment_status,
    payment_time
  )
`;

async function findProfileByPhone(phone) {
  return supabase
    .from("patient")
    .select("patient_id, account_id")
    .eq("phone", phone)
    .maybeSingle();
}

/**
 * BR-11: Fetch patient's no_show_count to check if they are booking-banned.
 */
async function findPatientById(patientId) {
  const { data, error } = await supabase
    .from("patient")
    .select("patient_id, account_id, full_name, phone, no_show_count")
    .eq("patient_id", patientId)
    .single();

  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  if (!data) throw new AppError("Không tìm thấy bệnh nhân.", 404, "NOT_FOUND");
  return data;
}

/**
 * BR-12: Transition all 'No-Show' appointments for this patient to 'Resolved No-Show'.
 * Also resets no_show_count to 0 since it is incremented manually by the scheduler
 * (no DB trigger auto-recomputes it).
 */
async function resolveNoShowAppointments(patientId) {
  // Step 1: Update all No-Show appointments → Resolved No-Show
  const { data, error } = await supabase
    .from("appointment")
    .update({ status: "Resolved No-Show" })
    .eq("patient_id", patientId)
    .eq("status", "No-Show")
    .select("appt_id");

  if (error) throw new AppError(error.message, 500, "DB_ERROR");

  // Step 2: Reset the penalty counter
  const { error: resetError } = await supabase
    .from("patient")
    .update({ no_show_count: 0 })
    .eq("patient_id", patientId);

  if (resetError) throw new AppError(resetError.message, 500, "DB_ERROR");

  return data || [];
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

function findTreatedPatientsByDentistId(dentistId) {
  return supabase
    .from("appointment")
    .select(`
      appt_id,
      patient_id,
      status,
      book_time,
      patient:patient_id (
        patient_id,
        full_name,
        phone
      ),
      treatment_record!inner (
        record_id,
        dentist_id
      ),
      appointment_service (
        dental_service:service_id (
          service_name
        )
      ),
      appointment_slot (
        is_primary,
        work_slot:slot_id (
          slot_config:slot_config_id (
            start_time,
            end_time
          ),
          schedules:schedule_id (
            work_date
          )
        )
      )
    `)
    .eq("treatment_record.dentist_id", dentistId)
    .order("book_time", { ascending: false });
}

module.exports = {
  createPatient,
  searchPatients,
  findProfileByPhone,
  findPatientById,
  resolveNoShowAppointments,
  findTreatmentHistoryByPatientId,
  findTreatedPatientsByDentistId,
  insertProfile,
  linkProfileAccount,
};
