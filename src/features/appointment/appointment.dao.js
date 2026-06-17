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
 * Base select string — joins all related tables needed by the appointment list.
 * Aliased columns keep the shape consistent regardless of caller.
 */
const APPOINTMENT_SELECT = `
  appt_id,
  status,
  total_estimated_amount,
  note,
  book_time,
  work_slot:slot_id (
    slot_id,
    slot_config:slot_config_id (
      start_time,
      end_time
    ),
    schedules:schedule_id (
      schedule_id,
      work_date,
      status,
      dentist:dentist_id (
        dentist_id,
        speciality,
        experience,
        avatar,
        account:account_id (
          account_id,
          username,
          email
        )
      )
    )
  ),
  patient:patient_id (
    patient_id,
    full_name,
    phone,
    email,
    dob,
    gender,
    address,
    medical_history,
    avatar,
    no_show_count
  ),
  appointment_service (
    actual_price,
    dental_service:service_id (
      service_id,
      service_name
    )
  ),
  treatment_record (
    record_id,
    diagnosis,
    treatment_note
  ),
  invoice (
    invoice_id,
    total_amount,
    payment_status,
    payment_time
  ),
  appointment_history (
    history_id,
    action_type,
    reason,
    created_at
  )
`.trim();

/**
 * Fetch all appointments for a specific patient (own appointments).
 */
async function findByPatientId(patientId, filters = {}) {
  ensureSupabase();

  let query = supabase
    .from("appointment")
    .select(APPOINTMENT_SELECT)
    .eq("patient_id", patientId)
    .order("book_time", { ascending: false });

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  return query;
}

/**
 * Fetch all appointments in the clinic (for receptionist / admin / owner).
 */
async function findAll(filters = {}) {
  ensureSupabase();

  let query = supabase
    .from("appointment")
    .select(APPOINTMENT_SELECT)
    .order("book_time", { ascending: false });

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  return query;
}

/**
 * Fetch a single appointment by its primary key.
 */
async function findById(apptId) {
  ensureSupabase();

  return supabase
    .from("appointment")
    .select(APPOINTMENT_SELECT)
    .eq("appt_id", apptId)
    .single();
}

/**
 * Cancel an appointment: update status to 'Cancelled' and log to appointment_history.
 */
async function cancelById(apptId, actorAccountId, reason) {
  ensureSupabase();

  const { data, error } = await supabase
    .from("appointment")
    .update({ status: "Cancelled" })
    .eq("appt_id", apptId)
    .select("appt_id, status")
    .single();

  if (error || !data) {
    throw new AppError(
      "Failed to cancel appointment.",
      500,
      "DB_ERROR",
    );
  }

  // Log cancellation to history (non-blocking; best-effort)
  supabase
    .from("appointment_history")
    .insert({
      appt_id: apptId,
      action_type: "Cancelled",
      actor_account_id: actorAccountId,
      reason: reason || null,
      created_at: new Date().toISOString(),
    })
    .then(({ error: histErr }) => {
      if (histErr) {
        console.error("[appointment.dao] history insert failed:", histErr.message);
      }
    });

  return data;
}

module.exports = {
  cancelById,
  findAll,
  findById,
  findByPatientId,
};
