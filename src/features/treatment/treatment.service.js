const treatmentDao = require("./treatment.dao");
const AppError = require("../../utils/AppError");

async function validateAppointment(apptId, dentistId) {
  const { data: appointment, error } =
    await treatmentDao.findAppointmentById(apptId);
  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  if (!appointment)
    throw new AppError("Không tìm thấy lịch hẹn.", 404, "NOT_FOUND");
  const primarySlot = (appointment.appointment_slot || []).find(
    (slot) => slot.is_primary,
  );
  const assignedDentistId =
    primarySlot?.work_slot?.schedules?.dentist?.dentist_id;
  if (String(assignedDentistId) !== String(dentistId)) {
    throw new AppError(
      "Bạn không phải bác sĩ phụ trách lịch hẹn này.",
      403,
      "FORBIDDEN",
    );
  }
  if (appointment.status !== "In-Treatment") {
    throw new AppError(
      "Chỉ có thể ghi kết quả cho lịch đang điều trị.",
      409,
      "INVALID_STATUS_TRANSITION",
    );
  }
  const existingInvoice = Array.isArray(appointment.invoice)
    ? appointment.invoice[0]
    : appointment.invoice;
  if (existingInvoice) {
    throw new AppError(
      "Lịch hẹn đã có hóa đơn.",
      409,
      "INVOICE_EXISTS",
    );
  }
  const { data: existing, error: existingError } =
    await treatmentDao.findByAppointmentId(apptId);
  if (existingError) throw new AppError(existingError.message, 500, "DB_ERROR");
  if (existing)
    throw new AppError(
      "Lịch hẹn đã có kết quả điều trị.",
      409,
      "TREATMENT_EXISTS",
    );
  return appointment;
}

async function createTreatment({
  apptId,
  dentistId,
  diagnosis,
  treatmentNote,
}) {
  const normalizedDiagnosis = diagnosis?.trim();
  const normalizedNote = treatmentNote?.trim();
  if (!normalizedDiagnosis || !normalizedNote) {
    throw new AppError(
      "Chẩn đoán và nội dung điều trị là bắt buộc.",
      400,
      "VALIDATION_ERROR",
    );
  }
  const appointment = await validateAppointment(apptId, dentistId);

  const record = await treatmentDao.create({
    appt_id: apptId,
    dentist_id: dentistId,
    diagnosis: normalizedDiagnosis,
    treatment_note: normalizedNote,
  });
  let invoice = null;

  try {
    const serviceTotal = (appointment.appointment_service || []).reduce(
      (total, item) => total + Number(item.actual_price || 0),
      0,
    );
    invoice = await treatmentDao.createInvoice({
      appt_id: apptId,
      receptionist_id: null,
      total_amount: serviceTotal,
      payment_time: null,
      payment_status: "Unpaid",
    });

    const completed = await treatmentDao.completeAppointment(apptId);
    if (!completed) {
      throw new AppError(
        "Trạng thái lịch hẹn vừa thay đổi. Vui lòng tải lại.",
        409,
        "APPOINTMENT_STATUS_CHANGED",
      );
    }
    return {
      ...record,
      invoice,
      appointmentStatus: completed.status,
    };
  } catch (error) {
    if (invoice) await treatmentDao.removeInvoice(invoice.invoice_id);
    await treatmentDao.remove(record.record_id);
    throw error;
  }
}

module.exports = { createTreatment };
