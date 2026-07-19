const treatmentDao = require("./treatment.dao");
const AppError = require("../../utils/AppError");

async function listMedicines() {
  const { data, error } = await treatmentDao.findActiveMedicines();
  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  return data || [];
}

function normalizePrescriptionItems(items = []) {
  if (!Array.isArray(items)) {
    throw new AppError(
      "Danh sách thuốc không hợp lệ.",
      400,
      "VALIDATION_ERROR",
    );
  }
  const normalized = items.map((item) => ({
    medicineId: Number(item.medicineId),
    dosage: item.dosage?.trim(),
    quantity: Number(item.quantity),
  }));
  const medicineIds = normalized.map((item) => item.medicineId);
  if (
    normalized.some(
      (item) =>
        !Number.isInteger(item.medicineId) ||
        !item.dosage ||
        !Number.isInteger(item.quantity) ||
        item.quantity <= 0,
    )
  ) {
    throw new AppError(
      "Mỗi thuốc phải có liều dùng và số lượng nguyên lớn hơn 0.",
      400,
      "VALIDATION_ERROR",
    );
  }
  if (new Set(medicineIds).size !== medicineIds.length) {
    throw new AppError(
      "Không thể kê trùng một loại thuốc.",
      400,
      "DUPLICATE_MEDICINE",
    );
  }
  return normalized;
}

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
  prescriptionNote,
  medicines,
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
  const normalizedMedicines = normalizePrescriptionItems(medicines);
  const appointment = await validateAppointment(apptId, dentistId);

  let medicineById = new Map();
  if (normalizedMedicines.length) {
    const { data, error } = await treatmentDao.findMedicinesByIds(
      normalizedMedicines.map((item) => item.medicineId),
    );
    if (error) throw new AppError(error.message, 500, "DB_ERROR");
    medicineById = new Map(
      (data || []).map((medicine) => [medicine.medicine_id, medicine]),
    );
    normalizedMedicines.forEach((item) => {
      const medicine = medicineById.get(item.medicineId);
      if (!medicine || medicine.status !== "Active") {
        throw new AppError(
          "Thuốc đã chọn không còn được sử dụng.",
          409,
          "MEDICINE_UNAVAILABLE",
        );
      }
      if (medicine.stock_quantity < item.quantity) {
        throw new AppError(
          `${medicine.name} chỉ còn ${medicine.stock_quantity} ${medicine.unit}.`,
          409,
          "INSUFFICIENT_STOCK",
        );
      }
    });
  }

  const record = await treatmentDao.create({
    appt_id: apptId,
    dentist_id: dentistId,
    diagnosis: normalizedDiagnosis,
    treatment_note: normalizedNote,
  });
  let prescription = null;
  let invoice = null;
  const decreasedItems = [];

  try {
    if (normalizedMedicines.length) {
      prescription = await treatmentDao.createPrescription({
        record_id: record.record_id,
        prescribed_date: new Date().toISOString().slice(0, 10),
        note: prescriptionNote?.trim() || null,
      });
      await treatmentDao.createPrescriptionDetails(
        normalizedMedicines.map((item) => ({
          prescription_id: prescription.prescription_id,
          medicine_id: item.medicineId,
          dosage: item.dosage,
          quantity: item.quantity,
          actual_price: medicineById.get(item.medicineId).unit_price,
        })),
      );
      for (const item of normalizedMedicines) {
        const medicine = medicineById.get(item.medicineId);
        const updated = await treatmentDao.decreaseMedicineStock(
          medicine,
          item.quantity,
        );
        if (!updated) {
          throw new AppError(
            `Tồn kho ${medicine.name} vừa thay đổi. Vui lòng kiểm tra lại.`,
            409,
            "STOCK_CHANGED",
          );
        }
        decreasedItems.push({ medicine, quantity: item.quantity });
      }
    }

    const serviceTotal = (appointment.appointment_service || []).reduce(
      (total, item) => total + Number(item.actual_price || 0),
      0,
    );
    const medicineTotal = normalizedMedicines.reduce(
      (total, item) =>
        total + Number(medicineById.get(item.medicineId).unit_price || 0) * item.quantity,
      0,
    );
    invoice = await treatmentDao.createInvoice({
      appt_id: apptId,
      receptionist_id: null,
      total_amount: serviceTotal + medicineTotal,
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
      prescription,
      invoice,
      appointmentStatus: completed.status,
    };
  } catch (error) {
    if (invoice) await treatmentDao.removeInvoice(invoice.invoice_id);
    for (const item of decreasedItems.reverse()) {
      await treatmentDao.restoreMedicineStock(item.medicine, item.quantity);
    }
    if (prescription)
      await treatmentDao.removePrescription(prescription.prescription_id);
    await treatmentDao.remove(record.record_id);
    throw error;
  }
}

module.exports = { createTreatment, listMedicines };
