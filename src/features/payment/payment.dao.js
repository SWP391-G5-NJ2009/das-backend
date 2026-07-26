const supabase = require("../../config/supabase");

const INVOICE_PAYMENT_SELECT = `
  invoice_id,
  total_amount,
  payment_status,
  payment_time,
  payment_method,
  transaction_code,
  appointment:appt_id (
    appt_id,
    patient:patient_id (patient_id, full_name, phone),
    appointment_service (
      actual_price,
      dental_service:service_id (service_id, service_name)
    ),
    appointment_slot (
      is_primary,
      work_slot:slot_id (
        time_slot_config:slot_config_id (start_time),
        schedules:schedule_id (
          work_date,
          dentist:dentist_id (dentist_id, full_name)
        )
      )
    )
  )
`.trim();
const PATIENT_INVOICE_SELECT = INVOICE_PAYMENT_SELECT
  .replace("appointment:appt_id (", "appointment:appt_id!inner (")
  .replace("patient:patient_id (", "patient:patient_id!inner (");

function findAllPayments() {
  return supabase
    .from("invoice")
    .select(INVOICE_PAYMENT_SELECT)
    .eq("payment_status", "Paid")
    .order("payment_time", { ascending: false });
}

function findPaymentsByPatientId(patientId) {
  return supabase
    .from("invoice")
    .select(PATIENT_INVOICE_SELECT)
    .eq("payment_status", "Paid")
    .eq("appointment.patient.patient_id", patientId)
    .order("payment_time", { ascending: false });
}

function findUnpaidInvoices() {
  return supabase
    .from("invoice")
    .select(INVOICE_PAYMENT_SELECT)
    .or("payment_status.neq.Paid,payment_status.is.null")
    .order("invoice_id", { ascending: false });
}

function findPaymentById(invoiceId) {
  return supabase
    .from("invoice")
    .select(INVOICE_PAYMENT_SELECT)
    .eq("invoice_id", invoiceId)
    .eq("payment_status", "Paid")
    .maybeSingle();
}

function findInvoiceById(invoiceId) {
  return supabase
    .from("invoice")
    .select(INVOICE_PAYMENT_SELECT)
    .eq("invoice_id", invoiceId)
    .maybeSingle();
}

function markInvoicePaid({
  invoiceId,
  paymentTime,
  paymentMethod,
  transactionCode,
}) {
  return supabase
    .from("invoice")
    .update({
      payment_status: "Paid",
      payment_time: paymentTime,
      payment_method: paymentMethod,
      transaction_code: transactionCode,
    })
    .eq("invoice_id", invoiceId)
    .neq("payment_status", "Paid")
    .select(INVOICE_PAYMENT_SELECT)
    .maybeSingle();
}

module.exports = {
  findAllPayments,
  findPaymentsByPatientId,
  findInvoiceById,
  findPaymentById,
  findUnpaidInvoices,
  markInvoicePaid,
};
