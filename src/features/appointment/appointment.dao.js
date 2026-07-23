const supabase = require("../../config/supabase");
const AppError = require("../../utils/AppError");
const logger = require("../../utils/logger");

const APPOINTMENT_SELECT = `
  appt_id,
  status,
  treatment_plan_id,
  visit_number,
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
          experience,
          room_info (
            room_id,
            room_name
          )
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
    no_show_count,
    account:account_id (
      status
    )
  ),
  appointment_service (
    actual_price,
    dental_service:service_id (
      service_id,
      service_name,
      treatment_mode
    )
  ),
  treatment_record (
    record_id,
    clinical_examination,
    diagnosis,
    treatment_note,
    post_treatment_instructions
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
    .eq("patient_id", patientId);

  if (filters.status && filters.status !== "all") {
    query = query.eq("status", filters.status);
  }

  return query;
}

async function findAll(filters = {}) {
  let query = supabase.from("appointment").select(APPOINTMENT_SELECT);

  if (Array.isArray(filters.statuses) && filters.statuses.length > 0) {
    query = query.in("status", filters.statuses);
  } else if (filters.status && filters.status !== "all") {
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
    throw new AppError("Không thể hủy lịch hẹn.", 500, "DB_ERROR");
  }

  return data;
}

async function checkInById(apptId, expectedStatus = "Confirmed") {
  const { data, error } = await supabase
    .from("appointment")
    .update({ status: "Checked-in" })
    .eq("appt_id", apptId)
    .eq("status", expectedStatus)
    .select("appt_id, status")
    .maybeSingle();

  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  return data;
}

async function reconcileNoShowAfterCheckIn(patientId) {
  const { data: patient, error: readError } = await supabase
    .from("patient")
    .select("patient_id, no_show_count")
    .eq("patient_id", patientId)
    .maybeSingle();
  if (readError) throw new AppError(readError.message, 500, "DB_ERROR");
  if (!patient) return;

  const currentCount = Number(patient.no_show_count || 0);
  const nextCount = Math.max(0, currentCount - 1);
  const { error: updateError } = await supabase
    .from("patient")
    .update({ no_show_count: nextCount })
    .eq("patient_id", patientId)
    .eq("no_show_count", currentCount);
  if (updateError) throw new AppError(updateError.message, 500, "DB_ERROR");
}

async function startTreatmentById(apptId) {
  const { data, error } = await supabase
    .from("appointment")
    .update({ status: "In-Treatment" })
    .eq("appt_id", apptId)
    .eq("status", "Checked-in")
    .select("appt_id, status")
    .maybeSingle();

  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  return data;
}

async function markSlotBooked(slotId) {
  const { data, error } = await supabase
    .from("work_slot")
    .update({ status: "Booked" })
    .eq("slot_id", slotId)
    .eq("status", "Available")
    .select("slot_id")
    .maybeSingle();

  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  return data;
}

async function findConsecutiveSlotsFromId(startSlotId, count) {
  const { data: anchor, error: anchorError } = await supabase
    .from("work_slot")
    .select(
      `
      slot_id,
      status,
      schedule_id,
      time_slot_config:slot_config_id (
        slot_config_id,
        start_time
      )
    `,
    )
    .eq("slot_id", startSlotId)
    .maybeSingle();

  if (anchorError) throw new AppError(anchorError.message, 500, "DB_ERROR");
  if (!anchor)
    throw new AppError("Không tìm thấy khung giờ bắt đầu.", 404, "NOT_FOUND");

  const scheduleId = anchor.schedule_id;
  const anchorStartTime = anchor.time_slot_config?.start_time;

  if (!scheduleId || !anchorStartTime) {
    throw new AppError("Cấu hình khung giờ chưa đầy đủ.", 500, "DB_ERROR");
  }

  const { data: slots, error: slotsError } = await supabase
    .from("work_slot")
    .select(
      `
      slot_id,
      status,
      time_slot_config:slot_config_id (
        start_time
      )
    `,
    )
    .eq("schedule_id", scheduleId)
    .order("slot_config_id", { ascending: true });

  if (slotsError) throw new AppError(slotsError.message, 500, "DB_ERROR");

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
      if (claimed.length > 0) {
        await supabase
          .from("work_slot")
          .update({ status: "Available" })
          .in("slot_id", claimed);
      }
      throw new AppError(error.message, 500, "DB_ERROR");
    }

    if (!data) {
      if (claimed.length > 0) {
        await supabase
          .from("work_slot")
          .update({ status: "Available" })
          .in("slot_id", claimed);
      }
      return null;
    }

    claimed.push(slotId);
  }

  return claimed;
}

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

async function findSlotInfo(slotId) {
  const { data, error } = await supabase
    .from("work_slot")
    .select(
      `
      slot_id,
      time_slot_config:slot_config_id (start_time, end_time),
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
    .select(
      "appt_id, status, book_time, note, total_estimated_amount, treatment_plan_id, visit_number",
    )
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

async function insertAppointmentSlots(rows) {
  const { error } = await supabase.from("appointment_slot").insert(rows);
  if (error) throw new AppError(error.message, 500, "DB_ERROR");
}

async function findSlotsByApptId(apptId) {
  const { data, error } = await supabase
    .from("appointment_slot")
    .select("slot_id")
    .eq("appt_id", apptId);

  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  return (data || []).map((r) => r.slot_id);
}

async function getServicePrice(serviceId) {
  const { data, error } = await supabase
    .from("dental_services")
    .select("unit_price")
    .eq("service_id", serviceId)
    .single();

  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  if (!data) throw new AppError("Không tìm thấy dịch vụ.", 404, "NOT_FOUND");
  return data.unit_price;
}

async function getServiceBookingConfig(serviceId) {
  const { data, error } = await supabase
    .from("dental_services")
    .select("service_id, unit_price, treatment_mode")
    .eq("service_id", serviceId)
    .maybeSingle();

  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  if (!data) {
    throw new AppError("Không tìm thấy dịch vụ.", 404, "NOT_FOUND");
  }
  return data;
}

async function findActiveTreatmentPlan(patientId, serviceId) {
  const { data, error } = await supabase
    .from("treatment_plan")
    .select("plan_id, patient_id, service_id, status")
    .eq("patient_id", patientId)
    .eq("service_id", serviceId)
    .eq("status", "Active")
    .maybeSingle();

  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  return data;
}

/**
 * BR-15: Check if patient already has an active appointment for a given service.
 */
async function findConfirmedAppointmentByService(patientId, serviceId) {
  const ACTIVE_STATUSES = ["Confirmed", "Checked-in", "Conflict"];

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
    .in("status", ACTIVE_STATUSES)
    .eq("appointment_service.service_id", serviceId)
    .limit(1);

  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  return data && data.length > 0 ? data[0] : null;
}

/**
 * Check if a patient already has an active appointment at the same date + time.
 * Prevents a patient from having two appointments at overlapping times,
 * even with different dentists (different slot_ids but same time window).
 */
async function findActiveAppointmentByPatientAtTime(
  patientId,
  workDate,
  startTime,
) {
  const ACTIVE_STATUSES = ["Confirmed", "Checked-in", "Conflict"];

  const { data, error } = await supabase
    .from("appointment")
    .select(
      `
      appt_id,
      status,
      appointment_slot!inner (
        slot_id,
        work_slot:slot_id!inner (
          slot_config_id,
          time_slot_config:slot_config_id!inner (start_time),
          schedule_id,
          schedules:schedule_id!inner (work_date)
        )
      )
    `,
    )
    .eq("patient_id", patientId)
    .in("status", ACTIVE_STATUSES)
    .eq("appointment_slot.work_slot.schedules.work_date", workDate)
    .eq("appointment_slot.work_slot.time_slot_config.start_time", startTime)
    .limit(1);

  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  return data && data.length > 0 ? data[0] : null;
}

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

async function hasAnyAppointmentByServiceId(serviceId) {
  const { data, error } = await supabase
    .from("appointment_service")
    .select("appt_id")
    .eq("service_id", serviceId)
    .limit(1);

  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  return Array.isArray(data) && data.length > 0;
}

async function markOverdueAsNoShow() {
  const now = new Date();

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

  const NO_SHOW_GRACE_MS = 15 * 60 * 1000;
  const overdueIds = [];
  const overduePatientIds = {};

  for (const appt of candidates) {
    const primaryEntry = (appt.appointment_slot || []).find(
      (as) => as.is_primary,
    );
    const workDate = primaryEntry?.work_slot?.schedules?.work_date;
    const startTime = primaryEntry?.work_slot?.time_slot_config?.start_time;
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



module.exports = {
  cancelById,
  checkInById,
  createAppointment,
  findAll,
  findActiveTreatmentPlan,
  findById,
  findByPatientId,
  findActiveAppointmentByPatientAtTime,
  findConfirmedAppointmentByService,
  findConsecutiveSlotsFromId,
  findSlotInfo,
  findSlotsByApptId,
  getServicePrice,
  getServiceBookingConfig,
  hasActiveAppointmentsByServiceId,
  hasAnyAppointmentByServiceId,
  insertAppointmentServices,
  insertAppointmentSlots,
  markMultipleSlotsBooked,
  markNoShowSlotAvailable: releaseSlot,
  markOverdueAsNoShow,
  markSlotBooked,
  reconcileNoShowAfterCheckIn,
  releaseSlot,
  releaseSlotsByIds,
  startTreatmentById,
};
