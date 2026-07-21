const supabase = require("../../config/supabase");

async function findAllPayments() {
  return supabase
    .from("payment")
    .select(
      `
      payment_id,
      invoice_id,
      amount,
      payment_method,
      payment_date,
      transaction_code,
      status,
      invoice:invoice_id (
        invoice_id,
        total_amount,
        payment_status,
        appointment:appt_id (
          appt_id,
          patient:patient_id (patient_id, full_name, phone),
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
      )
    `,
    )
    .order("payment_date", { ascending: false });
}

async function findPaymentsByPatientId(patientId) {
  return supabase
    .from("payment")
    .select(
      `
      payment_id,
      invoice_id,
      amount,
      payment_method,
      payment_date,
      transaction_code,
      status,
      invoice:invoice_id!inner (
        invoice_id,
        total_amount,
        payment_status,
        appointment:appt_id!inner (
          appt_id,
          patient:patient_id!inner (patient_id, full_name, phone),
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
      )
    `,
    )
    .eq("invoice.appointment.patient.patient_id", patientId)
    .order("payment_date", { ascending: false });
}

async function findUnpaidInvoices() {
  return supabase
    .from("invoice")
    .select(
      `
      invoice_id,
      total_amount,
      payment_status,
      payment_time,
      appointment:appt_id (
        appt_id,
        patient:patient_id (patient_id, full_name, phone),
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
    `,
    )
    .or("payment_status.neq.Paid,payment_status.is.null")
    .order("invoice_id", { ascending: false });
}

async function findPaymentById(paymentId) {
  return supabase
    .from("payment")
    .select(
      `
      payment_id,
      invoice_id,
      amount,
      payment_method,
      payment_date,
      transaction_code,
      status,
      invoice:invoice_id (
        invoice_id,
        total_amount,
        payment_status,
        payment_time,
        appointment:appt_id (
          appt_id,
          patient:patient_id (patient_id, full_name, phone),
          appointment_service (
            actual_price,
            dental_service:service_id (service_id, service_name)
          ),
          treatment_record (
            record_id,
            prescription (
              prescription_id,
              note,
              prescription_detail (
                dosage,
                quantity,
                actual_price,
                medicine:medicine_id (
                  medicine_id,
                  name,
                  unit,
                  unit_price
                )
              )
            )
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
      )
    `,
    )
    .eq("payment_id", paymentId)
    .maybeSingle();
}

async function findInvoiceById(invoiceId) {
  return supabase
    .from("invoice")
    .select(`
      invoice_id,
      total_amount,
      payment_status,
      appointment:appt_id (
        appt_id,
        patient:patient_id (patient_id, full_name, phone),
        appointment_service (
          actual_price,
          dental_service:service_id (service_id, service_name)
        ),
        treatment_record (
          record_id,
          prescription (
            prescription_id,
            prescription_detail (
              dosage,
              quantity,
              actual_price,
              medicine:medicine_id (medicine_id, name, unit, unit_price)
            )
          )
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
    `)
    .eq("invoice_id", invoiceId)
    .maybeSingle();
}

async function createPayment(payload) {
  return supabase.from("payment").insert(payload).select().single();
}

async function markInvoicePaid(invoiceId, paymentTime) {
  return supabase
    .from("invoice")
    .update({ payment_status: "Paid", payment_time: paymentTime })
    .eq("invoice_id", invoiceId)
    .neq("payment_status", "Paid")
    .select()
    .maybeSingle();
}

module.exports = {
  createPayment,
  findAllPayments,
  findPaymentsByPatientId,
  findInvoiceById,
  findPaymentById,
  findUnpaidInvoices,
  markInvoicePaid,
};
