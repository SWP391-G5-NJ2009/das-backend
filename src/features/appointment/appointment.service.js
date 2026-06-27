const appointmentDao = require("./appointment.dao");
const patientDao = require("../patient/patient.dao");
const AppError = require("../../utils/AppError");

/* ─────────────────────────────────────────────────────────────────────────────
   bookAppointment — Patient or Receptionist creates a new appointment
───────────────────────────────────────────────────────────────────────────── */
async function bookAppointment({ patientId, newPatient, slotId, serviceId, note, actorAccountId, actorRole, slotOccupied = 1 }) {
  // ── Walk-in patient: create patient record on the fly ────────────────────
  let resolvedPatientId = patientId;
  if (!resolvedPatientId && newPatient) {
    const created = await patientDao.createPatient(newPatient);
    resolvedPatientId = created.patient_id;
  }
  if (!resolvedPatientId) {
    throw new AppError("Patient ID could not be resolved.", 400, "VALIDATION_ERROR");
  }

  // ── BR-11: Block patient with ≥ 3 No-Shows from booking online ──────────
  if (actorRole === "patient") {
    const patientInfo = await patientDao.findPatientById(resolvedPatientId);
    if (patientInfo.no_show_count >= 3) {
      throw new AppError(
        "Your account has been restricted from booking appointments online due to 3 or more no-shows. " +
          "Please contact the clinic directly for assistance.",
        403,
        "BOOKING_BANNED_NO_SHOW",
      );
    }
  }
  // ── End BR-11 ────────────────────────────────────────────────────────────

  // ── BR-14: Validate slot timing before attempting to claim it ────────────

  const slotInfo = await appointmentDao.findSlotInfo(slotId);
  if (!slotInfo) {
    throw new AppError("Slot not found.", 404, "NOT_FOUND");
  }

  const workDate = slotInfo.schedules?.work_date;         // "YYYY-MM-DD"
  const startTime = slotInfo.time_slot_config?.start_time; // "HH:MM:SS"

  if (workDate && startTime) {
    // Build the exact start datetime of the slot in server local time
    const slotDateTime = new Date(`${workDate}T${startTime}`);
    const now = new Date();
    const diffMs = slotDateTime.getTime() - now.getTime();

    // Block everyone: slot start time has already passed
    if (diffMs <= 0) {
      throw new AppError(
        "This time slot has already passed and can no longer be booked.",
        400,
        "SLOT_PAST",
      );
    }

    // Block patients only: slot starts within 30 minutes
    if (actorRole === "patient" && diffMs < 30 * 60 * 1000) {
      throw new AppError(
        "Appointments must be booked at least 30 minutes in advance.",
        400,
        "SLOT_TOO_SOON",
      );
    }
  }
  // ── End BR-14 ────────────────────────────────────────────────────────────

  // ── BR-15: One active appointment per service per patient (patient only) ──
  if (actorRole === "patient") {
    const conflict = await appointmentDao.findConfirmedAppointmentByService(
      resolvedPatientId,
      serviceId,
    );
    if (conflict) {
      throw new AppError(
        "You already have an active appointment for this service. " +
          "Please wait until your current appointment is checked in, cancelled, or resolved before booking again.",
        409,
        "DUPLICATE_SERVICE_BOOKING",
      );
    }
  }
  // ── End BR-15 ────────────────────────────────────────────────────────────

  // ── Multi-slot: find all consecutive slots this service requires ──────────
  const normalizedSlotCount = Math.max(1, Number(slotOccupied) || 1);

  let allSlotIds;
  if (normalizedSlotCount === 1) {
    // Fast path: single-slot service
    const claimedSlot = await appointmentDao.markSlotBooked(slotId);
    if (!claimedSlot) {
      throw new AppError(
        "This time slot has just been booked by another user. Please select a different slot.",
        409,
        "SLOT_TAKEN",
      );
    }
    allSlotIds = [slotId];
  } else {
    // Multi-slot: validate consecutive slots exist and are all Available
    const consecutiveSlots = await appointmentDao.findConsecutiveSlotsFromId(
      slotId,
      normalizedSlotCount,
    );

    if (consecutiveSlots.length < normalizedSlotCount) {
      throw new AppError(
        `This service requires ${normalizedSlotCount} consecutive time slots, but only ${consecutiveSlots.length} slots are available at the end of this schedule. Please choose an earlier time.`,
        409,
        "INSUFFICIENT_CONSECUTIVE_SLOTS",
      );
    }

    // Validate all required slots are Available before claiming any
    const unavailable = consecutiveSlots.filter((s) => s.status !== "Available");
    if (unavailable.length > 0) {
      throw new AppError(
        "One or more required consecutive time slots are not available. Please choose a different start time.",
        409,
        "SLOT_TAKEN",
      );
    }

    // Atomically claim all slots
    const slotIdsToClaim = consecutiveSlots.map((s) => s.slot_id);
    const claimedIds = await appointmentDao.markMultipleSlotsBooked(slotIdsToClaim);
    if (!claimedIds) {
      throw new AppError(
        "One or more required time slots were just booked by another user. Please select a different start time.",
        409,
        "SLOT_TAKEN",
      );
    }
    allSlotIds = claimedIds;
  }
  // ── End multi-slot ───────────────────────────────────────────────────────

  // Step 2: Create appointment record (primary slot only — the anchor)
  const appointment = await appointmentDao.createAppointment({
    patient_id: resolvedPatientId,
    slot_id: slotId,
    status: "Confirmed",
    note: note || null,
    book_time: new Date().toISOString(),
  });

  // Step 3: Look up service price then link service to the appointment
  const actualPrice = await appointmentDao.getServicePrice(serviceId);
  await appointmentDao.insertAppointmentServices([
    { appt_id: appointment.appt_id, service_id: serviceId, actual_price: actualPrice },
  ]);

  // Step 4: Record all claimed slot IDs in appointment_slot junction table
  // is_primary = true for the anchor slot (stored in appointment.slot_id),
  // is_primary = false for each follow-on slot.
  await appointmentDao.insertAppointmentSlots(
    allSlotIds.map((sid) => ({
      appt_id: appointment.appt_id,
      slot_id: Number(sid),
      is_primary: Number(sid) === Number(slotId),
    })),
  );

  return appointment;

}

/* ─────────────────────────────────────────────────────────────────────────────
   Shape normalizer — maps raw Supabase joined row → clean frontend-ready object.
   Field names mirror the mock data shape used in the frontend hook.
───────────────────────────────────────────────────────────────────────────── */
const CANCELLABLE_STATUSES = ["Confirmed", "Waiting"];

function normalize(row) {
  const slotConfig = row.work_slot?.time_slot_config;
  const schedule = row.work_slot?.schedules;
  const dentist = schedule?.dentist;
  const services = (row.appointment_service || [])
    .map((item) => item.dental_service?.service_name)
    .filter(Boolean);

  return {
    id: String(row.appt_id),
    patientId: row.patient?.patient_id ?? null,
    patientName: row.patient?.full_name || null,
    patientPhone: row.patient?.phone || null,
    patientEmail: row.patient?.email || null,
    patientDob: row.patient?.birth_date || null,
    patientGender: row.patient?.gender || null,
    patientAddress: row.patient?.address || null,
    patientNoShowCount: row.patient?.no_show_count ?? 0,

    serviceName: services.join(", ") || null,
    services: (row.appointment_service || []).map((as) => ({
      serviceId: as.dental_service?.service_id,
      serviceName: as.dental_service?.service_name,
      actualPrice: as.actual_price,
      slotOccupied: as.dental_service?.slot_occupied ?? 1,
    })),
    slotOccupied: (row.appointment_service || []).reduce(
      (sum, as) => sum + (as.dental_service?.slot_occupied ?? 1),
      0,
    ),
    dentistName: dentist?.full_name || null,
    dentistId: dentist?.dentist_id || null,
    dentistSpeciality: dentist?.speciality || null,
    dentistExperience: dentist?.experience || null,
    scheduledDate: schedule?.work_date || null,
    scheduledTime: slotConfig?.start_time
      ? slotConfig.start_time.substring(0, 5)
      : null,
    scheduledTimeEnd: (() => {
      // For multi-slot appointments, use the end_time of the LAST slot
      // (largest start_time in appointment_slot). Falls back to primary slot end_time.
      const allSlots = (row.appointment_slot || [])
        .map((as) => as.work_slot?.time_slot_config)
        .filter(Boolean)
        .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
      const lastSlotConfig = allSlots[allSlots.length - 1];
      const endTime = lastSlotConfig?.end_time || slotConfig?.end_time;
      return endTime ? endTime.substring(0, 5) : null;
    })(),
    status: row.status,
    notes: row.note || "",
    bookTime: row.book_time,
    totalEstimatedAmount: row.total_estimated_amount || null,
    treatmentRecord: row.treatment_record?.[0] || null,
    invoice: row.invoice?.[0] || null,
  };
}

function applyClientFilters(list, filters) {
  let result = list;

  // Exact day takes priority; otherwise fall through to month, then year
  if (filters.date) {
    result = result.filter((a) => a.scheduledDate === filters.date);
  } else if (filters.month) {
    // filters.month is "YYYY-MM"
    result = result.filter((a) => a.scheduledDate?.startsWith(filters.month));
  } else if (filters.year) {
    // filters.year is "YYYY"
    result = result.filter((a) => a.scheduledDate?.startsWith(filters.year));
  }

  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (a) =>
        a.patientName?.toLowerCase().includes(q) ||
        a.serviceName?.toLowerCase().includes(q) ||
        a.dentistName?.toLowerCase().includes(q) ||
        a.patientPhone?.includes(q),
    );
  }

  if (filters.dentistId) {
    result = result.filter(
      (a) => String(a.dentistId) === String(filters.dentistId),
    );
  }

  return result;
}

async function getMyAppointments(patientId, filters = {}) {
  const { data, error } = await appointmentDao.findByPatientId(
    patientId,
    filters,
  );

  if (error) {
    throw new AppError(error.message, 500, "DB_ERROR");
  }

  return applyClientFilters((data || []).map(normalize), filters);
}

async function getAll(filters = {}) {
  const { data, error } = await appointmentDao.findAll(filters);

  if (error) {
    throw new AppError(error.message, 500, "DB_ERROR");
  }

  return applyClientFilters((data || []).map(normalize), filters);
}

async function cancelAppointment(apptId, actorAccountId, reason, role, patientId) {
  const { data: existing, error } = await appointmentDao.findById(apptId);

  if (error || !existing) {
    throw new AppError("Appointment not found.", 404, "NOT_FOUND");
  }

  if (role === "patient" && existing.patient_id !== patientId) {
    throw new AppError("Access denied.", 403, "FORBIDDEN");
  }

  if (!CANCELLABLE_STATUSES.includes(existing.status)) {
    throw new AppError(
      `Cannot cancel an appointment with status "${existing.status}".`,
      400,
      "INVALID_STATUS_TRANSITION",
    );
  }

  // ── BR-13: Patients can only cancel at least 24 hours before scheduled time ──
  if (role === "patient") {
    const slotId = existing.work_slot?.slot_id;
    if (slotId) {
      const slotInfo = await appointmentDao.findSlotInfo(slotId);
      if (slotInfo) {
        const workDate = slotInfo.schedules?.work_date;
        const startTime = slotInfo.time_slot_config?.start_time;
        if (workDate && startTime) {
          const slotDateTime = new Date(`${workDate}T${startTime}`);
          const diffMs = slotDateTime.getTime() - Date.now();
          if (diffMs < 24 * 60 * 60 * 1000) {
            throw new AppError(
              "Appointments can only be cancelled at least 24 hours before the scheduled time. Please contact the receptionist directly for assistance.",
              400,
              "CANCEL_TOO_LATE",
            );
          }
        }
      }
    }
  }
  // ── End BR-13 ────────────────────────────────────────────────────────────────

  const cancelled = await appointmentDao.cancelById(apptId, actorAccountId, reason);

  // Release all slots linked to this appointment (non-blocking).
  // appointment_slot rows are cascade-deleted when appointment is cancelled,
  // but we read them BEFORE cancel so we know which work_slots to free.
  // (We already fetched `existing` above — primary slot is on existing.work_slot.slot_id;
  //  we re-query appointment_slot for the full list to handle multi-slot services.)
  appointmentDao
    .findSlotsByApptId(apptId)
    .then((slotIds) => {
      if (slotIds.length > 0) {
        return appointmentDao.releaseSlotsByIds(slotIds);
      }
      // Fallback: if junction table has no rows yet (legacy appointment),
      // release the primary slot the old way.
      const primarySlotId = existing.work_slot?.slot_id;
      if (primarySlotId) {
        return appointmentDao.releaseSlotsByIds([primarySlotId]);
      }
    })
    .catch((err) =>
      console.error("[appointment.service] slot release failed:", err.message),
    );

  return cancelled;
}

module.exports = {
  bookAppointment,
  cancelAppointment,
  getAll,
  getMyAppointments,
};
