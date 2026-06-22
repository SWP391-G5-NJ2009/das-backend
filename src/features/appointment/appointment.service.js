const appointmentDao = require("./appointment.dao");
const AppError = require("../../utils/AppError");

const CANCELLABLE_STATUSES = ["Confirmed", "Waiting"];

function normalize(row) {
  const slotConfig = row.work_slot?.slot_config;
  const schedule = row.work_slot?.schedules;
  const dentist = schedule?.dentist;
  const services = (row.appointment_service || [])
    .map((item) => item.dental_service?.service_name)
    .filter(Boolean);

  return {
    id: String(row.appt_id),
    patientName: row.patient?.full_name || null,
    patientPhone: row.patient?.phone || null,
    patientEmail: row.patient?.email || null,
    patientDob: row.patient?.birth_date || null,
    patientGender: row.patient?.gender || null,
    patientAddress: row.patient?.address || null,
    patientNoShowCount: row.patient?.no_show_count ?? 0,
    serviceName: services.join(", ") || null,
    services: (row.appointment_service || []).map((item) => ({
      serviceId: item.dental_service?.service_id,
      serviceName: item.dental_service?.service_name,
      actualPrice: item.actual_price,
    })),
    dentistName: dentist
      ? `BS. ${dentist.account?.username || dentist.account?.email || "?"}`
      : null,
    dentistId: dentist?.dentist_id || null,
    dentistSpeciality: dentist?.speciality || null,
    dentistExperience: dentist?.experience || null,
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

function applyClientFilters(list, filters) {
  let result = list;

  if (filters.date) {
    result = result.filter((a) => a.scheduledDate === filters.date);
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

  return appointmentDao.cancelById(apptId, actorAccountId, reason);
}

module.exports = {
  cancelAppointment,
  getAll,
  getMyAppointments,
};
