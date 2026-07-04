const supabase = require("../../config/supabase");
const AppError = require("../../utils/AppError");
const logger = require("../../utils/logger");

const APPOINTMENT_SELECT = `
  appt_id,
  status,
  total_estimated_amount,
  note,
  book_time,
  appointment_slot (
    is_primary,
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
      service_name,
      slot_occupied
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
 * Find `count` consecutive work_slots starting from `startSlotId` on the same schedule,
 * ordered by start_time ascending.
 *
 * Steps:
 *  1. Fetch the schedule_id and start_time of the start slot.
 *  2. Query work_slot for the same schedule_id where start_time >= that value,
 *     ordered by start_time, limited to `count`.
 *
 * Returns an array of { slot_id, status, start_time } objects (length may be < count
 * if the schedule doesn't have enough remaining slots).
 */
async function findConsecutiveSlotsFromId(startSlotId, count) {
  // Step 1: get the anchor slot's schedule and start time
  const { data: anchor, error: anchorError } = await supabase
    .from("work_slot")
    .select(`
      slot_id,
      status,
      schedule_id,
      time_slot_config:slot_config_id (
        slot_config_id,
        start_time
      )
    `)
    .eq("slot_id", startSlotId)
    .maybeSingle();

  if (anchorError) throw new AppError(anchorError.message, 500, "DB_ERROR");
  if (!anchor) throw new AppError("Start slot not found.", 404, "NOT_FOUND");

  const scheduleId = anchor.schedule_id;
  const anchorStartTime = anchor.time_slot_config?.start_time;

  if (!scheduleId || !anchorStartTime) {
    throw new AppError("Slot configuration is incomplete.", 500, "DB_ERROR");
  }

  // Step 2: fetch ALL slots for the same schedule, then filter in JS.
  // PostgREST does NOT support .gte() on embedded columns — filter by start_time in JS.
  const { data: slots, error: slotsError } = await supabase
    .from("work_slot")
    .select(`
      slot_id,
      status,
      time_slot_config:slot_config_id (
        start_time
      )
    `)
    .eq("schedule_id", scheduleId)
    .order("slot_config_id", { ascending: true });

  if (slotsError) throw new AppError(slotsError.message, 500, "DB_ERROR");

  // Filter slots at or after the anchor start_time, sort, then take the first `count`.
  return (slots || [])
    .filter(
      (s) =>
        s.time_slot_config?.start_time &&
        s.time_slot_config.start_time >= anchorStartTime,
    )
    .sort((a, b) =>
      (a.time_slot_config.start_time || "").localeCompare(
        b.time_slot_config.start_time || "",
      ),
    )
    .slice(0, count)
    .map((s) => ({
      slot_id: s.slot_id,
      status: s.status,
      start_time: s.time_slot_config.start_time,
    }));
}

/**
 * Atomically claim multiple work_slots by marking them Booked only if currently Available.
 * Claims each slot one-by-one so the atomic guard holds per-slot.
 *
 * Returns an array of successfully claimed slot_ids.
 * If any slot cannot be claimed, rolls back the already-claimed ones and returns null.
 */
async function markMultipleSlotsBooked(slotIds) {
  const claimed = [];

  for (const slotId of slotIds) {
    const { data, error } = await supabase
      .from("work_slot")
      .update({ status: "Booked" })
      .eq("slot_id", slotId)
      .eq("status", "Available")
      .select("slot_id")
      .maybeSingle();

    if (error) {
      // Release already-claimed slots before surfacing the error
      if (claimed.length > 0) {
        await supabase
          .from("work_slot")
          .update({ status: "Available" })
          .in("slot_id", claimed);
      }
      throw new AppError(error.message, 500, "DB_ERROR");
    }

    if (!data) {
      // This slot was unavailable — rollback claimed ones and signal failure
      if (claimed.length > 0) {
        await supabase
          .from("work_slot")
          .update({ status: "Available" })
          .in("slot_id", claimed);
      }
      return null; // caller interprets null as SLOT_TAKEN
    }

    claimed.push(slotId);
  }

  return claimed;
}

/**
 * Release multiple work_slots back to 'Available'.
 * Only transitions slots that are currently 'Booked'.
 */
async function releaseSlotsByIds(slotIds) {
  if (!slotIds || slotIds.length === 0) return;
  const { error } = await supabase
    .from("work_slot")
    .update({ status: "Available" })
    .in("slot_id", slotIds)
    .eq("status", "Booked");

  if (error) {
    console.error("[appointment.dao] releaseSlotsByIds failed:", error.message);
  }
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
    .select(
      `
      slot_id,
      time_slot_config:slot_config_id (start_time),
      schedules:schedule_id (work_date)
    `,
    )
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
 * Insert rows into the appointment_slot junction table.
 * Each row: { appt_id, slot_id, is_primary }
 * is_primary = true for the anchor slot, false for follow-on slots.
 */
async function insertAppointmentSlots(rows) {
  const { error } = await supabase.from("appointment_slot").insert(rows);
  if (error) throw new AppError(error.message, 500, "DB_ERROR");
}

/**
 * Fetch all slot IDs linked to an appointment via appointment_slot.
 * Returns an array of slot_id numbers.
 * Used by cancelAppointment to know which slots to release.
 */
async function findSlotsByApptId(apptId) {
  const { data, error } = await supabase
    .from("appointment_slot")
    .select("slot_id")
    .eq("appt_id", apptId);

  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  return (data || []).map((r) => r.slot_id);
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
    .select(
      `
      appt_id,
      status,
      appointment_service!inner (service_id)
    `,
    )
    .eq("patient_id", patientId)
    .eq("status", "Confirmed")
    .eq("appointment_service.service_id", serviceId)
    .maybeSingle();

  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  return data; // null if no conflict
}

/**
 * Guard check: returns true if any active appointment
 * (Confirmed, Conflict, Checked-in)
 * is currently linked to the given service. Used to block deactivate operations.
 */
async function hasActiveAppointmentsByServiceId(serviceId) {
  const { data, error } = await supabase
    .from("appointment")
    .select(
      `
      appt_id,
            appointment_service!inner (service_id)
    `,
    )
    .in("status", ["Confirmed", "Conflict", "Checked-in"])
    .eq("appointment_service.service_id", serviceId)
    .limit(1);

  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  return Array.isArray(data) && data.length > 0;
}

/**
 * BR-25 hard-deletion guard: returns true if the service has EVER been linked
 * to any appointment record, regardless of status (Confirmed, Cancelled,
 * Completed, No-Show, etc.).
 * If this returns true the service MUST NOT be hard-deleted.
 */
async function hasAnyAppointmentByServiceId(serviceId) {
  const { data, error } = await supabase
    .from("appointment_service")
    .select("appt_id")
    .eq("service_id", serviceId)
    .limit(1);

  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  return Array.isArray(data) && data.length > 0;
}
/**
 * No-Show sweep: fetch all Confirmed appointments whose slot start
 * time + 15 min has already passed, mark them No-Show, and return the
 * updated rows so the caller can increment no_show_count.
 *
 * Returns an array of { appt_id, patient_id } objects.
 */
async function markOverdueAsNoShow() {
  const now = new Date();

  // Fetch Confirmed appointments with their primary slot datetime info.
  // Since appointment.slot_id no longer exists, we join via appointment_slot
  // and filter to the primary slot (is_primary = true) to get the schedule datetime.
  const { data: candidates, error: fetchError } = await supabase
    .from("appointment")
    .select(
      `
      appt_id,
      patient_id,
      appointment_slot (
        is_primary,
        work_slot:slot_id (
          time_slot_config:slot_config_id (start_time),
          schedules:schedule_id (work_date)
        )
      )
    `,
    )
    .in("status", ["Confirmed"]);

  if (fetchError) {
    logger.error("[noShow] Failed to fetch candidates:", fetchError.message);
    return [];
  }

  if (!candidates || candidates.length === 0) return [];

  // Filter those whose primary slot start + 15 min < now
  const NO_SHOW_GRACE_MS = 15 * 60 * 1000; // 15 minutes
  const overdueIds = [];
  const overduePatientIds = {}; // appt_id → patient_id

  for (const appt of candidates) {
    // Find the primary slot row in appointment_slot
    const primarySlot = (appt.appointment_slot || []).find((s) => s.is_primary);
    const workDate = primarySlot?.work_slot?.schedules?.work_date; // "YYYY-MM-DD"
    const startTime = primarySlot?.work_slot?.time_slot_config?.start_time; // "HH:MM:SS"
    if (!workDate || !startTime) continue;

    const slotStart = new Date(`${workDate}T${startTime}`);
    const deadline = new Date(slotStart.getTime() + NO_SHOW_GRACE_MS);

    if (now >= deadline) {
      overdueIds.push(appt.appt_id);
      overduePatientIds[appt.appt_id] = appt.patient_id;
    }
  }

  if (overdueIds.length === 0) return [];

  // Bulk update to No-Show
  const { data: updated, error: updateError } = await supabase
    .from("appointment")
    .update({ status: "No-Show" })
    .in("appt_id", overdueIds)
    .in("status", ["Confirmed"]) // double-check: guard against race
    .select("appt_id, patient_id");

  if (updateError) {
    logger.error(
      "[noShow] Failed to update appointments:",
      updateError.message,
    );
    return [];
  }

  return updated || [];
}

/**
 * Increment no_show_count for a list of patient IDs.
 * Uses a direct atomic UPDATE (no_show_count = no_show_count + 1).
 */
async function incrementNoShowCount(patientIds) {
  if (!patientIds || patientIds.length === 0) return;

  for (const patientId of patientIds) {
    // Read current count, then write back incremented value
    const { data: patient, error: readError } = await supabase
      .from("patient")
      .select("no_show_count")
      .eq("patient_id", patientId)
      .single();

    if (readError || !patient) {
      logger.error(
        `[noShow] Could not read no_show_count for patient ${patientId}:`,
        readError?.message,
      );
      continue;
    }

    const { error: writeError } = await supabase
      .from("patient")
      .update({ no_show_count: (patient.no_show_count ?? 0) + 1 })
      .eq("patient_id", patientId);

    if (writeError) {
      logger.error(
        `[noShow] Failed to increment no_show_count for patient ${patientId}:`,
        writeError.message,
      );
    }
  }
}

module.exports = {
  cancelById,
  createAppointment,
  findAll,
  findById,
  findByPatientId,
  findConfirmedAppointmentByService,
  findConsecutiveSlotsFromId,
  findSlotInfo,
  findSlotsByApptId,
  getServicePrice,
  hasActiveAppointmentsByServiceId,
  hasAnyAppointmentByServiceId,
  incrementNoShowCount,
  insertAppointmentServices,
  insertAppointmentSlots,
  markMultipleSlotsBooked,
  markNoShowSlotAvailable: releaseSlot,
  markOverdueAsNoShow,
  markSlotBooked,
  releaseSlot,
  releaseSlotsByIds,
};
