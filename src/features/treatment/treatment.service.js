const treatmentDao = require("./treatment.dao");
const AppError = require("../../utils/AppError");

function getPrimarySlot(appointment) {
  return (appointment.appointment_slot || []).find((slot) => slot.is_primary);
}

function getAssignedDentist(appointment) {
  return getPrimarySlot(appointment)?.work_slot?.schedules?.dentist || null;
}

function mapVisit(appointment, fallbackVisitNumber = 1) {
  const primarySlot = getPrimarySlot(appointment);
  const schedule = primarySlot?.work_slot?.schedules;
  const record = Array.isArray(appointment.treatment_record)
    ? appointment.treatment_record[0]
    : appointment.treatment_record;

  return {
    appointmentId: appointment.appt_id,
    visitNumber: appointment.visit_number || fallbackVisitNumber,
    status: appointment.status,
    treatmentDate: schedule?.work_date || null,
    treatmentTime: primarySlot?.work_slot?.time_slot_config?.start_time || null,
    dentistName:
      record?.dentist?.full_name || schedule?.dentist?.full_name || null,
    clinicalExamination: record?.clinical_examination || "",
    diagnosis: record?.diagnosis || "",
    treatmentNote: record?.treatment_note || "",
    postTreatmentInstructions:
      record?.post_treatment_instructions || "",
    isCurrent: false,
    isEditable: appointment.status === "In-Treatment" && !record,
  };
}

async function getTreatmentContext({ apptId, dentistId }) {
  const { data: appointment, error } =
    await treatmentDao.findContextAppointmentById(apptId);
  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  if (!appointment) {
    throw new AppError("Không tìm thấy lịch hẹn.", 404, "NOT_FOUND");
  }

  const assignedDentist = getAssignedDentist(appointment);
  if (String(assignedDentist?.dentist_id) !== String(dentistId)) {
    throw new AppError(
      "Bạn không phải bác sĩ phụ trách lịch hẹn này.",
      403,
      "FORBIDDEN",
    );
  }

  let serviceName =
    appointment.appointment_service?.[0]?.dental_service?.service_name ||
    "Dịch vụ điều trị";
  const treatmentMode =
    appointment.appointment_service?.[0]?.dental_service?.treatment_mode ||
    "Single-Visit";
  let planId = appointment.treatment_plan_id || null;
  let planStatus = null;
  let visits = [mapVisit(appointment)];

  if (planId) {
    const { data: plan, error: planError } =
      await treatmentDao.findPlanById(planId);
    if (planError) throw new AppError(planError.message, 500, "DB_ERROR");
    if (!plan || String(plan.patient_id) !== String(appointment.patient_id)) {
      throw new AppError(
        "Kế hoạch điều trị không hợp lệ.",
        409,
        "INVALID_TREATMENT_PLAN",
      );
    }

    serviceName = plan.dental_service?.service_name || serviceName;
    planStatus = plan.status;
    visits = (plan.appointment || [])
      .slice()
      .sort(
        (first, second) =>
          Number(first.visit_number || 0) - Number(second.visit_number || 0),
      )
      .map((visit, index) => mapVisit(visit, index + 1));
  }

  visits = visits.map((visit) => ({
    ...visit,
    isCurrent: String(visit.appointmentId) === String(apptId),
    isEditable:
      String(visit.appointmentId) === String(apptId) && visit.isEditable,
  }));

  return {
    planId,
    planStatus,
    serviceName,
    treatmentMode,
    visits,
  };
}

async function startTreatmentPlan({ apptId, dentistId }) {
  const { data: appointment, error } =
    await treatmentDao.findContextAppointmentById(apptId);
  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  if (!appointment) {
    throw new AppError("Không tìm thấy lịch hẹn.", 404, "NOT_FOUND");
  }

  const assignedDentist = getAssignedDentist(appointment);
  if (String(assignedDentist?.dentist_id) !== String(dentistId)) {
    throw new AppError(
      "Bạn không phải bác sĩ phụ trách lịch hẹn này.",
      403,
      "FORBIDDEN",
    );
  }
  if (appointment.status !== "In-Treatment") {
    throw new AppError(
      "Chỉ có thể bắt đầu lộ trình khi bệnh nhân đang điều trị.",
      409,
      "INVALID_STATUS_TRANSITION",
    );
  }
  if (appointment.treatment_plan_id) {
    throw new AppError(
      "Lịch hẹn đã thuộc một kế hoạch điều trị.",
      409,
      "TREATMENT_PLAN_EXISTS",
    );
  }

  const appointmentService = appointment.appointment_service?.[0];
  if (
    !appointmentService ||
    appointmentService.dental_service?.treatment_mode !== "Multi-Visit"
  ) {
    throw new AppError(
      "Dịch vụ này không được cấu hình điều trị theo lộ trình.",
      409,
      "SERVICE_NOT_MULTI_VISIT",
    );
  }

  const existingPlan = await treatmentDao.findActivePlanByPatientAndService(
    appointment.patient_id,
    appointmentService.service_id,
  );
  if (existingPlan) {
    throw new AppError(
      "Bệnh nhân đã có một lộ trình đang hoạt động cho dịch vụ này.",
      409,
      "ACTIVE_TREATMENT_PLAN_EXISTS",
    );
  }

  const plan = await treatmentDao.createTreatmentPlan({
    patient_id: appointment.patient_id,
    service_id: appointmentService.service_id,
    dentist_id: dentistId,
    status: "Active",
    agreed_price: Number(appointmentService.actual_price || 0),
  });

  try {
    const linkedAppointment = await treatmentDao.attachAppointmentToPlan(
      apptId,
      plan.plan_id,
    );
    if (!linkedAppointment) {
      throw new AppError(
        "Trạng thái lịch hẹn vừa thay đổi. Vui lòng tải lại.",
        409,
        "APPOINTMENT_STATUS_CHANGED",
      );
    }
    return { ...plan, appointment: linkedAppointment };
  } catch (linkError) {
    await treatmentDao.removeTreatmentPlan(plan.plan_id);
    throw linkError;
  }
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
  clinicalExamination,
  diagnosis,
  treatmentNote,
  postTreatmentInstructions,
  completePlan = false,
}) {
  const normalizedClinicalExamination = clinicalExamination?.trim() || null;
  const normalizedDiagnosis = diagnosis?.trim();
  const normalizedNote = treatmentNote?.trim();
  const normalizedInstructions =
    postTreatmentInstructions?.trim() || null;
  if (!normalizedDiagnosis || !normalizedNote) {
    throw new AppError(
      "Chẩn đoán và nội dung điều trị là bắt buộc.",
      400,
      "VALIDATION_ERROR",
    );
  }
  if (
    (normalizedClinicalExamination?.length || 0) > 2000 ||
    (normalizedInstructions?.length || 0) > 2000
  ) {
    throw new AppError(
      "Khám lâm sàng và hướng dẫn sau điều trị không được vượt quá 2000 ký tự.",
      400,
      "VALIDATION_ERROR",
    );
  }
  const appointment = await validateAppointment(apptId, dentistId);
  const treatmentPlan = Array.isArray(appointment.treatment_plan)
    ? appointment.treatment_plan[0]
    : appointment.treatment_plan;

  if (completePlan && !appointment.treatment_plan_id) {
    throw new AppError(
      "Lịch hẹn này không thuộc kế hoạch điều trị.",
      409,
      "TREATMENT_PLAN_REQUIRED",
    );
  }
  if (completePlan && treatmentPlan?.status !== "Active") {
    throw new AppError(
      "Kế hoạch điều trị không còn hoạt động.",
      409,
      "TREATMENT_PLAN_NOT_ACTIVE",
    );
  }

  const record = await treatmentDao.create({
    appt_id: apptId,
    dentist_id: dentistId,
    clinical_examination: normalizedClinicalExamination,
    diagnosis: normalizedDiagnosis,
    treatment_note: normalizedNote,
    post_treatment_instructions: normalizedInstructions,
  });
  let invoice = null;
  let invoiceWasCreated = false;
  let planWasCompleted = false;

  try {
    if (appointment.treatment_plan_id) {
      invoice = await treatmentDao.findInvoiceByTreatmentPlanId(
        appointment.treatment_plan_id,
      );
      if (!invoice) {
        const planInvoiceResult =
          await treatmentDao.createInvoiceForTreatmentPlan({
          appt_id: apptId,
          treatment_plan_id: appointment.treatment_plan_id,
          receptionist_id: null,
          total_amount: Number(treatmentPlan?.agreed_price || 0),
          payment_time: null,
          payment_status: "Unpaid",
          });
        invoice = planInvoiceResult.invoice;
        invoiceWasCreated = planInvoiceResult.created;
      }
    } else {
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
      invoiceWasCreated = true;
    }

    const completed = await treatmentDao.completeAppointment(apptId);
    if (!completed) {
      throw new AppError(
        "Trạng thái lịch hẹn vừa thay đổi. Vui lòng tải lại.",
        409,
        "APPOINTMENT_STATUS_CHANGED",
      );
    }
    let completedPlan = null;
    if (completePlan) {
      completedPlan = await treatmentDao.completeTreatmentPlan(
        appointment.treatment_plan_id,
      );
      if (!completedPlan) {
        throw new AppError(
          "Trạng thái kế hoạch điều trị vừa thay đổi. Vui lòng tải lại.",
          409,
          "TREATMENT_PLAN_STATUS_CHANGED",
        );
      }
      planWasCompleted = true;
    }

    return {
      ...record,
      invoice,
      appointmentStatus: completed.status,
      treatmentPlan: completedPlan,
    };
  } catch (error) {
    if (planWasCompleted && appointment.treatment_plan_id) {
      await treatmentDao.reopenTreatmentPlan(appointment.treatment_plan_id);
    }
    await treatmentDao.reopenAppointment(apptId);
    if (invoiceWasCreated && invoice) {
      await treatmentDao.removeInvoice(invoice.invoice_id);
    }
    await treatmentDao.remove(record.record_id);
    throw error;
  }
}

module.exports = {
  createTreatment,
  getTreatmentContext,
  startTreatmentPlan,
};
