const supabase = require("../../config/supabase");
const AppError = require("../../utils/AppError");

async function findAppointmentById(apptId) {
  return supabase
    .from("appointment")
    .select(
      `
      appt_id,
      status,
      appointment_service (actual_price),
      invoice (invoice_id),
      appointment_slot (
        is_primary,
        work_slot:slot_id (
          schedules:schedule_id (
            dentist:dentist_id (dentist_id)
          )
        )
      )
    `,
    )
    .eq("appt_id", apptId)
    .maybeSingle();
}

async function findByAppointmentId(apptId) {
  return supabase
    .from("treatment_record")
    .select("record_id")
    .eq("appt_id", apptId)
    .maybeSingle();
}

async function create(payload) {
  const { data, error } = await supabase
    .from("treatment_record")
    .insert(payload)
    .select()
    .single();
  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  return data;
}

async function createInvoice(payload) {
  const { data, error } = await supabase
    .from("invoice")
    .insert(payload)
    .select("invoice_id, appt_id, total_amount, payment_status")
    .single();
  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  return data;
}

async function completeAppointment(apptId) {
  const { data, error } = await supabase
    .from("appointment")
    .update({ status: "Completed" })
    .eq("appt_id", apptId)
    .eq("status", "In-Treatment")
    .select("appt_id, status")
    .maybeSingle();
  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  return data;
}

async function removeInvoice(invoiceId) {
  await supabase.from("invoice").delete().eq("invoice_id", invoiceId);
}

async function remove(recordId) {
  await supabase.from("treatment_record").delete().eq("record_id", recordId);
}

module.exports = {
  completeAppointment,
  create,
  createInvoice,
  findAppointmentById,
  findByAppointmentId,
  remove,
  removeInvoice,
};
