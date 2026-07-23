const supabase = require("../../config/supabase");
const AppError = require("../../utils/AppError");

async function findAppointmentById(apptId) {
  return supabase
    .from("appointment")
    .select(
      `
      appt_id,
      status,
      treatment_plan_id,
      treatment_plan:treatment_plan_id (plan_id, status, agreed_price),
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

async function findContextAppointmentById(apptId) {
  return supabase
    .from("appointment")
    .select(
      `
      appt_id,
      patient_id,
      status,
      treatment_plan_id,
      visit_number,
      appointment_service (
        service_id,
        actual_price,
        dental_service:service_id (service_name, treatment_mode)
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
      ),
      treatment_record (
        record_id,
        clinical_examination,
        diagnosis,
        treatment_note,
        post_treatment_instructions,
        dentist:dentist_id (dentist_id, full_name)
      )
    `,
    )
    .eq("appt_id", apptId)
    .maybeSingle();
}

async function findPlanById(planId) {
  return supabase
    .from("treatment_plan")
    .select(
      `
      plan_id,
      patient_id,
      service_id,
      status,
      dental_service:service_id (service_name),
      appointment (
        appt_id,
        status,
        visit_number,
        appointment_slot (
          is_primary,
          work_slot:slot_id (
            time_slot_config:slot_config_id (start_time),
            schedules:schedule_id (
              work_date,
              dentist:dentist_id (dentist_id, full_name)
            )
          )
        ),
        treatment_record (
          record_id,
          clinical_examination,
          diagnosis,
          treatment_note,
          post_treatment_instructions,
          dentist:dentist_id (dentist_id, full_name)
        )
      )
    `,
    )
    .eq("plan_id", planId)
    .maybeSingle();
}

async function createTreatmentPlan(payload) {
  const { data, error } = await supabase
    .from("treatment_plan")
    .insert(payload)
    .select(
      "plan_id, patient_id, service_id, dentist_id, status, agreed_price, created_at",
    )
    .single();
  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  return data;
}

async function findActivePlanByPatientAndService(patientId, serviceId) {
  const { data, error } = await supabase
    .from("treatment_plan")
    .select("plan_id")
    .eq("patient_id", patientId)
    .eq("service_id", serviceId)
    .eq("status", "Active")
    .maybeSingle();
  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  return data;
}

async function attachAppointmentToPlan(apptId, planId) {
  const { data, error } = await supabase
    .from("appointment")
    .update({ treatment_plan_id: planId, visit_number: 1 })
    .eq("appt_id", apptId)
    .eq("status", "In-Treatment")
    .is("treatment_plan_id", null)
    .is("visit_number", null)
    .select("appt_id, treatment_plan_id, visit_number")
    .maybeSingle();
  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  return data;
}

async function removeTreatmentPlan(planId) {
  await supabase
    .from("treatment_plan")
    .delete()
    .eq("plan_id", planId)
    .eq("status", "Active");
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
    .select(
      "invoice_id, appt_id, treatment_plan_id, total_amount, payment_status",
    )
    .single();
  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  return data;
}

async function findInvoiceByTreatmentPlanId(planId) {
  const { data, error } = await supabase
    .from("invoice")
    .select(
      "invoice_id, appt_id, treatment_plan_id, total_amount, payment_status, payment_time",
    )
    .eq("treatment_plan_id", planId)
    .maybeSingle();
  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  return data;
}

async function createInvoiceForTreatmentPlan(payload) {
  const { data, error } = await supabase
    .from("invoice")
    .insert(payload)
    .select(
      "invoice_id, appt_id, treatment_plan_id, total_amount, payment_status",
    )
    .single();

  if (!error) return { invoice: data, created: true };
  if (error.code === "23505") {
    const existingInvoice = await findInvoiceByTreatmentPlanId(
      payload.treatment_plan_id,
    );
    if (existingInvoice) {
      return { invoice: existingInvoice, created: false };
    }
  }
  throw new AppError(error.message, 500, "DB_ERROR");
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

async function completeTreatmentPlan(planId) {
  const { data, error } = await supabase
    .from("treatment_plan")
    .update({
      status: "Completed",
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("plan_id", planId)
    .eq("status", "Active")
    .select("plan_id, status, completed_at")
    .maybeSingle();
  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  return data;
}

async function reopenAppointment(apptId) {
  await supabase
    .from("appointment")
    .update({ status: "In-Treatment" })
    .eq("appt_id", apptId)
    .eq("status", "Completed");
}

async function reopenTreatmentPlan(planId) {
  await supabase
    .from("treatment_plan")
    .update({
      status: "Active",
      completed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("plan_id", planId)
    .eq("status", "Completed");
}

async function removeInvoice(invoiceId) {
  await supabase.from("invoice").delete().eq("invoice_id", invoiceId);
}

async function remove(recordId) {
  await supabase.from("treatment_record").delete().eq("record_id", recordId);
}

module.exports = {
  attachAppointmentToPlan,
  completeAppointment,
  completeTreatmentPlan,
  create,
  createInvoice,
  createInvoiceForTreatmentPlan,
  createTreatmentPlan,
  findAppointmentById,
  findActivePlanByPatientAndService,
  findByAppointmentId,
  findContextAppointmentById,
  findInvoiceByTreatmentPlanId,
  findPlanById,
  remove,
  removeInvoice,
  removeTreatmentPlan,
  reopenAppointment,
  reopenTreatmentPlan,
};
