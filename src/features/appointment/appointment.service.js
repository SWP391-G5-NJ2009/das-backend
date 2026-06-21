const appointmentDao = require("./appointment.dao");
const AppError = require("../../utils/AppError");

/* ─────────────────────────────────────────────────────────────────────────────
   bookAppointment — Patient or Receptionist creates a new appointment
───────────────────────────────────────────────────────────────────────────── */
async function bookAppointment({ patientId, slotId, serviceId, note, actorAccountId }) {
  // Step 1: Atomic slot claim — guards against concurrent bookings
  const claimedSlot = await appointmentDao.markSlotBooked(slotId);
  if (!claimedSlot) {
    throw new AppError(
      "This time slot has just been booked by another user. Please select a different slot.",
      409,
      "SLOT_TAKEN",
    );
  }

  // Step 2: Create appointment record
  const appointment = await appointmentDao.createAppointment({
    patient_id: patientId,
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

  // Step 4: Log to history (non-blocking — failure never rejects the booking)
  // TODO: trigger SMS/Email notification here (to be implemented by another dev)
  Promise.allSettled([
    appointmentDao.insertHistory({
      appt_id: appointment.appt_id,
      action_type: "Booked",
      actor_account_id: actorAccountId,
      reason: null,
      created_at: new Date().toISOString(),
    }),
  ]).then((results) => {
    results.forEach(
      (r) => r.status === "rejected" && console.error("[booking]", r.reason),
    );
  });

  return appointment;
}

/* ─────────────────────────────────────────────────────────────────────────────
   Shape normalizer — maps raw Supabase joined row → clean frontend-ready object.
   Field names mirror the mock data shape used in the frontend hook.
───────────────────────────────────────────────────────────────────────────── */
function normalize(row) {
  const slotConfig = row.work_slot?.time_slot_config;
  const schedule = row.work_slot?.schedules;
  const dentist = schedule?.dentist;

  // Collect service names for display
  const services = (row.appointment_service || []).map(
    (as) => as.dental_service?.service_name,
  ).filter(Boolean);

  return {
    id: String(row.appt_id),
    patientName: row.patient?.full_name || null,
    patientPhone: row.patient?.phone || null,
    patientEmail: row.patient?.email || null,
    patientDob: row.patient?.dob || null,
    patientGender: row.patient?.gender || null,
    patientAddress: row.patient?.address || null,
    patientMedicalHistory: row.patient?.medical_history || null,
    patientAvatar: row.patient?.avatar || null,
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
    dentistName: dentist ? `BS. ${dentist.account?.username || dentist.account?.email || "?"}` : null,
    dentistId: dentist?.dentist_id || null,
    dentistSpeciality: dentist?.speciality || null,
    dentistExperience: dentist?.experience || null,
    dentistAvatar: dentist?.avatar || null,
    scheduledDate: schedule?.work_date || null,
    scheduledTime: slotConfig?.start_time
      ? slotConfig.start_time.substring(0, 5)
      : null,
    scheduledTimeEnd: slotConfig?.end_time
      ? slotConfig.end_time.substring(0, 5)
      : null,
    status: row.status,
    notes: row.note || "",
    bookTime: row.book_time,
    totalEstimatedAmount: row.total_estimated_amount || null,
    treatmentRecord: row.treatment_record?.[0] || null,
    invoice: row.invoice?.[0] || null,
    history: row.appointment_history || [],
  };
}

/* ─────────────────────────────────────────────────────────────────────────────
   Shared filter helpers (applied after fetching — for search/date which need
   app-level filtering since they span joined columns).
───────────────────────────────────────────────────────────────────────────── */
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

  return result;
}

/* ─────────────────────────────────────────────────────────────────────────────
   getMyAppointments — Patient: fetch own appointments
───────────────────────────────────────────────────────────────────────────── */
async function getMyAppointments(patientId, filters = {}) {
  const { data, error } = await appointmentDao.findByPatientId(
    patientId,
    filters,
  );

  if (error) {
    throw new AppError(error.message, 500, "DB_ERROR");
  }

  const normalized = (data || []).map(normalize);
  return applyClientFilters(normalized, filters);
}

/* ─────────────────────────────────────────────────────────────────────────────
   getAll — Receptionist/Admin/Owner: fetch all clinic appointments
───────────────────────────────────────────────────────────────────────────── */
async function getAll(filters = {}) {
  const { data, error } = await appointmentDao.findAll(filters);

  if (error) {
    throw new AppError(error.message, 500, "DB_ERROR");
  }

  const normalized = (data || []).map(normalize);
  return applyClientFilters(normalized, filters);
}

/* ─────────────────────────────────────────────────────────────────────────────
   cancelAppointment — Patient or Staff cancels an appointment
───────────────────────────────────────────────────────────────────────────── */
async function cancelAppointment(apptId, actorAccountId, reason, role, patientId) {
  // Verify the appointment exists before cancelling
  const { data: existing, error: fetchErr } = await appointmentDao.findById(apptId);

  if (fetchErr || !existing) {
    throw new AppError("Appointment not found.", 404, "NOT_FOUND");
  }

  // Patients may only cancel their own appointments
  if (role === "patient" && existing.patient_id !== patientId) {
    throw new AppError("Access denied.", 403, "FORBIDDEN");
  }

  // Only cancellable statuses
  const cancellable = ["Confirmed", "Waiting"];
  if (!cancellable.includes(existing.status)) {
    throw new AppError(
      `Cannot cancel an appointment with status "${existing.status}".`,
      400,
      "INVALID_STATUS_TRANSITION",
    );
  }

  const cancelled = await appointmentDao.cancelById(apptId, actorAccountId, reason);

  // Release the slot back to Available (non-blocking — failure is logged, not thrown)
  const slotId = existing.work_slot?.slot_id;
  if (slotId) {
    appointmentDao.releaseSlot(slotId).catch((err) =>
      console.error("[appointment.service] releaseSlot failed:", err.message),
    );
  }

  return cancelled;
}

module.exports = {
  bookAppointment,
  cancelAppointment,
  getAll,
  getMyAppointments,
};
