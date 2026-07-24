const supabase = require("../../config/supabase");
const AppError = require("../../utils/AppError");

const QUEUE_SELECT = `
  id,
  appointment_id,
  patient_id,
  dentist_id,
  room_id,
  queue_type,
  status,
  check_in_time,
  note,
  created_at,
  updated_at,
  patient:patient_id (
    patient_id,
    full_name,
    phone,
    email,
    birth_date,
    gender,
    address,
    no_show_count
  ),
  dentist:dentist_id (
    dentist_id,
    full_name,
    speciality,
    phone,
    email
  ),
  room:room_id (
    room_id,
    room_name,
    status
  ),
  appointment:appointment_id (
    appt_id,
    status,
    note,
    book_time,
    treatment_plan_id,
    visit_number,
    appointment_slot (
      is_primary,
      work_slot:slot_id (
        slot_id,
        time_slot_config:slot_config_id (
          start_time,
          end_time
        ),
        schedules:schedule_id (
          schedule_id,
          work_date
        )
      )
    ),
    appointment_service (
      actual_price,
      dental_service:service_id (
        service_id,
        service_name,
        treatment_mode,
        slot_occupied
      )
    )
  )
`.trim();

function findAll({ statuses, dentistId, roomId } = {}) {
  let query = supabase
    .from("queue")
    .select(QUEUE_SELECT)
    .order("check_in_time", { ascending: true });

  if (Array.isArray(statuses) && statuses.length > 0) {
    query = query.in("status", statuses);
  }
  if (dentistId) query = query.eq("dentist_id", dentistId);
  if (roomId) query = query.eq("room_id", roomId);

  return query;
}

function findById(queueId) {
  return supabase
    .from("queue")
    .select(QUEUE_SELECT)
    .eq("id", queueId)
    .maybeSingle();
}

async function createFollowUp({
  queueId,
  patientId,
  dentistId,
  scheduledFor,
  reason,
}) {
  const { data, error } = await supabase
    .from("follow_up_notification")
    .insert({
      queue_id: queueId,
      patient_id: patientId,
      dentist_id: dentistId,
      scheduled_for: scheduledFor,
      reason,
    })
    .select("id, queue_id, scheduled_for, reason, status, created_at")
    .single();

  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  return data;
}

module.exports = {
  createFollowUp,
  findAll,
  findById,
};
