const supabase = require("../../config/supabase");
const AppError = require("../../utils/AppError");
const logger = require("../../utils/logger");

const APPOINTMENT_SELECT = `
  appt_id,
  status,
  total_estimated_amount,
  note,
  book_time,
  work_slot:slot_id (
    slot_id,
    time_slot_config:slot_config_id (
      start_time,
      end_time
    ),
    schedules:schedule_id (
      schedule_id,
      work_date,
      status,
      dentist:dentist_id (
        dentist_id,
        full_name,
        speciality,
        experience
      )
    )
  ),
  patient:patient_id (
    patient_id,
    full_name,
    phone,
    email,
    birth_date,
    gender,
    address,
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

async function findByPatientId(patientId, filters = {}) {
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

async function findAll(filters = {}) {
  let query = supabase
    .from("appointment")
    .select(APPOINTMENT_SELECT)
    .order("book_time", { ascending: false });

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  return query;
}

async function findById(apptId) {
  return supabase
    .from("appointment")
    .select(APPOINTMENT_SELECT)
    .eq("appt_id", apptId)
    .single();
}

async function cancelById(apptId, actorAccountId, reason) {
  const { data, error } = await supabase
    .from("appointment")
    .update({ status: "Cancelled", note: reason || null })
    .eq("appt_id", apptId)
    .select("appt_id, status, note")
    .single();

  if (error || !data) {
    throw new AppError("Failed to cancel appointment.", 500, "DB_ERROR");
  }

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
        logger.error("Appointment history insert failed.", histErr);
      }
    });

  return data;
}


/**
 * Atomically claim a work_slot: set status = 'Booked' only if currently 'Available'.
 * Returns the updated slot row, or null if the slot was already taken/unavailable.
 */
async function markSlotBooked(slotId) {
  const { data, error } = await supabase
    .from("work_slot")
    .update({ status: "Booked" })
    .eq("slot_id", slotId)
    .eq("status", "Available") // atomic guard — only succeeds if still Available
    .select("slot_id")
    .maybeSingle();

  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  return data; // null means slot was already taken or unavailable
}

/**
 * Release a work_slot back to 'Available' when an appointment is cancelled.
 * Only transitions from 'Booked' → 'Available' (leaves 'Unavailable' slots untouched).
 */
async function releaseSlot(slotId) {
  const { error } = await supabase
    .from("work_slot")
    .update({ status: "Available" })
    .eq("slot_id", slotId)
    .eq("status", "Booked"); // only release if currently Booked

  if (error) {
    console.error("[appointment.dao] releaseSlot failed:", error.message);
  }
}

/**
 * Fetch the date and start time of a slot — used for BR-14 timing validation.
 * Returns { work_date: "YYYY-MM-DD", start_time: "HH:MM:SS" } or null.
 */
async function findSlotInfo(slotId) {
  const { data, error } = await supabase
    .from("work_slot")
    .select(`
      slot_id,
      time_slot_config:slot_config_id (start_time),
      schedules:schedule_id (work_date)
    `)
    .eq("slot_id", slotId)
    .maybeSingle();

  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  return data;
}

/**
 * Insert a new appointment row.
 */
async function createAppointment(payload) {
  const { data, error } = await supabase
    .from("appointment")
    .insert(payload)
    .select("appt_id, status, book_time, note, total_estimated_amount")
    .single();

  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  return data;
}

/**
 * Insert rows into appointment_service (one per service selected).
 */
async function insertAppointmentServices(rows) {
  const { error } = await supabase.from("appointment_service").insert(rows);
  if (error) throw new AppError(error.message, 500, "DB_ERROR");
}

/**
 * Insert a row into appointment_history (best-effort, non-blocking).
 */
async function insertHistory(row) {
  const { error } = await supabase.from("appointment_history").insert(row);
  if (error) {
    console.error("[appointment.dao] history insert failed:", error.message);
  }
}

/**
 * Fetch the price of a dental service by its ID.
 * Used to populate actual_price in appointment_service.
 */
async function getServicePrice(serviceId) {
  const { data, error } = await supabase
    .from("dental_services")
    .select("unit_price")
    .eq("service_id", serviceId)
    .single();

  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  if (!data) throw new AppError("Service not found.", 404, "NOT_FOUND");
  return data.unit_price;
}

/**
 * BR-15: Check if patient already has a 'Confirmed' appointment for a given service.
 * Returns the existing appointment row if found, null otherwise.
 */
async function findConfirmedAppointmentByService(patientId, serviceId) {
  const { data, error } = await supabase
    .from("appointment")
    .select(`
      appt_id,
      status,
      appointment_service!inner (service_id)
    `)
    .eq("patient_id", patientId)
    .eq("status", "Confirmed")
    .eq("appointment_service.service_id", serviceId)
    .maybeSingle();

  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  return data; // null if no conflict
}

module.exports = {
  cancelById,
  createAppointment,
  findAll,
  findById,
  findByPatientId,
  findConfirmedAppointmentByService,
  findSlotInfo,
  getServicePrice,
  insertAppointmentServices,
  insertHistory,
  markSlotBooked,
  releaseSlot,
};
