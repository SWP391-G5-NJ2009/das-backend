const paymentDao = require("./payment.dao");
const AppError = require("../../utils/AppError");

async function getAllPayments() {
  const { data, error } = await paymentDao.findAllPayments();

  if (error) {
    throw new AppError(error.message, 500, "DB_ERROR");
  }

  return (data || []).map(normalizePaymentRow);
}

async function getMyPaymentHistory(patientId) {
  const { data, error } = await paymentDao.findPaymentsByPatientId(patientId);
  if (error) {
    throw new AppError(error.message, 500, "DB_ERROR");
  }
  return (data || []).map(normalizePaymentRow);
}

function getAppointmentInfo(appointment) {
  const primarySlot = (appointment?.appointment_slot || []).find(
    (slot) => slot.is_primary,
  );
  const workSlot = primarySlot?.work_slot;
  return {
    appointmentId: appointment?.appt_id || null,
    patient: appointment?.patient || null,
    dentist: workSlot?.schedules?.dentist || null,
    appointmentDate: workSlot?.schedules?.work_date || null,
    appointmentTime: workSlot?.time_slot_config?.start_time || null,
  };
}

function normalizePaymentRow(invoice) {
  return {
    payment_id: invoice.invoice_id,
    invoice_id: invoice.invoice_id,
    amount: invoice.total_amount,
    payment_method: invoice.payment_method,
    payment_date: invoice.payment_time,
    transaction_code: invoice.transaction_code,
    status: invoice.payment_status,
    ...getAppointmentInfo(invoice.appointment),
  };
}

async function getUnpaidInvoices() {
  const { data, error } = await paymentDao.findUnpaidInvoices();
  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  return (data || []).map((invoice) => ({
    payment_id: null,
    invoice_id: invoice.invoice_id,
    amount: invoice.total_amount,
    payment_date: invoice.payment_time,
    status: invoice.payment_status || "Unpaid",
    ...getAppointmentInfo(invoice.appointment),
  }));
}

async function getPaymentDetail(paymentId) {
  const { data, error } = await paymentDao.findPaymentById(paymentId);

  if (error) {
    throw new AppError(error.message, 500, "DB_ERROR");
  }
  if (!data) {
    throw new AppError("Không tìm thấy hóa đơn.", 404, "NOT_FOUND");
  }

  const appointment = data.appointment;
  const appointmentInfo = getAppointmentInfo(appointment);

  return {
    paymentId: data.invoice_id,
    invoiceId: data.invoice_id,
    ...appointmentInfo,
    amount: data.total_amount,
    paymentMethod: data.payment_method,
    paymentDate: data.payment_time,
    transactionCode: data.transaction_code,
    status: data.payment_status,
    items: (appointment?.appointment_service || []).map((item) => ({
        id: item.dental_service?.service_id,
        name: item.dental_service?.service_name || "Dịch vụ nha khoa",
        type: "Dịch vụ",
        unitPrice: appointment.appointment_service.length === 1
          ? data.total_amount
          : item.actual_price,
        quantity: 1,
        total: appointment.appointment_service.length === 1
          ? data.total_amount
          : item.actual_price,
      })),
  };
}

async function getMyPaymentDetail(paymentId, patientId) {
  const detail = await getPaymentDetail(paymentId);
  if (String(detail.patient?.patient_id) !== String(patientId)) {
    throw new AppError("Không tìm thấy hóa đơn.", 404, "NOT_FOUND");
  }
  return detail;
}

async function getInvoiceDetail(invoiceId) {
  const { data, error } = await paymentDao.findInvoiceById(invoiceId);
  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  if (!data) throw new AppError("Không tìm thấy hóa đơn.", 404, "NOT_FOUND");

  const appointment = data.appointment;
  return {
    invoiceId: data.invoice_id,
    ...getAppointmentInfo(appointment),
    amount: data.total_amount,
    paymentMethod: data.payment_method,
    paymentDate: data.payment_time,
    transactionCode: data.transaction_code,
    status: data.payment_status || "Unpaid",
    items: (appointment?.appointment_service || []).map((item) => ({
        id: item.dental_service?.service_id,
        name: item.dental_service?.service_name || "Dịch vụ nha khoa",
        type: "Dịch vụ",
        unitPrice: appointment.appointment_service.length === 1
          ? data.total_amount
          : item.actual_price,
        quantity: 1,
        total: appointment.appointment_service.length === 1
          ? data.total_amount
          : item.actual_price,
      })),
  };
}

async function payInvoice(invoiceId, paymentMethod, requestedPaymentDate) {
  const allowedMethods = ["Tiền mặt", "Chuyển khoản"];
  if (!allowedMethods.includes(paymentMethod)) {
    throw new AppError(
      "Phương thức thanh toán không hợp lệ.",
      400,
      "PAYMENT_METHOD_INVALID",
    );
  }

  const { data: invoice, error: invoiceError } =
    await paymentDao.findInvoiceById(invoiceId);
  if (invoiceError) throw new AppError(invoiceError.message, 500, "DB_ERROR");
  if (!invoice) throw new AppError("Không tìm thấy hóa đơn.", 404, "NOT_FOUND");
  if (invoice.payment_status === "Paid") {
    throw new AppError(
      "Hóa đơn đã được thanh toán.",
      409,
      "INVOICE_ALREADY_PAID",
    );
  }

  const parsedPaymentDate = requestedPaymentDate
    ? new Date(requestedPaymentDate)
    : new Date();
  if (Number.isNaN(parsedPaymentDate.getTime())) {
    throw new AppError(
      "Ngày giao dịch không hợp lệ.",
      400,
      "PAYMENT_DATE_INVALID",
    );
  }
  if (parsedPaymentDate.getTime() > Date.now()) {
    throw new AppError(
      "Ngày giao dịch không được ở tương lai.",
      400,
      "PAYMENT_DATE_INVALID",
    );
  }
  const paymentDate = parsedPaymentDate.toISOString();
  const transactionCode =
    `PAY-${invoice.invoice_id}-${Date.now().toString(36).toUpperCase()}`;

  const { data: updatedInvoice, error: updateError } =
    await paymentDao.markInvoicePaid({
      invoiceId: invoice.invoice_id,
      paymentTime: paymentDate,
      paymentMethod,
      transactionCode,
    });
  if (updateError || !updatedInvoice) {
    throw new AppError(
      "Không thể cập nhật trạng thái hóa đơn.",
      409,
      "INVOICE_UPDATE_FAILED",
    );
  }

  return normalizePaymentRow(updatedInvoice);
}

module.exports = {
  getAllPayments,
  getMyPaymentHistory,
  getMyPaymentDetail,
  getInvoiceDetail,
  getPaymentDetail,
  getUnpaidInvoices,
  payInvoice,
};
