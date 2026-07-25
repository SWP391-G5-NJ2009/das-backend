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

function findAll({ statuses, dentistId } = {}) {
  let query = supabase
    .from("queue")
    .select(QUEUE_SELECT)
    .order("check_in_time", { ascending: true });

  if (Array.isArray(statuses) && statuses.length > 0) {
    query = query.in("status", statuses);
  }
  if (dentistId) query = query.eq("dentist_id", dentistId);

  return query;
}

function findById(queueId) {
  return supabase
    .from("queue")
    .select(QUEUE_SELECT)
    .eq("id", queueId)
    .maybeSingle();
}

function findPatientById(patientId) {
  return supabase
    .from("patient")
    .select("patient_id, full_name, phone")
    .eq("patient_id", patientId)
    .maybeSingle();
}

function findDentistById(dentistId) {
  return supabase
    .from("dentist")
    .select(`
      dentist_id,
      full_name,
      room_info (
        room_id,
        room_name,
        status
      )
    `)
    .eq("dentist_id", dentistId)
    .maybeSingle();
}

function findActiveByPatientId(patientId) {
  return supabase
    .from("queue")
    .select("id, status")
    .eq("patient_id", patientId)
    .in("status", ["WAITING", "ASSIGNED", "IN_PROGRESS"])
    .limit(1)
    .maybeSingle();
}

async function createWalkIn(payload) {
  const { data, error } = await supabase
    .from("queue")
    .insert(payload)
    .select(QUEUE_SELECT)
    .single();

  if (error) {
    if (error.code === "23505") {
      throw new AppError(
        "Bệnh nhân đã có một lượt đang hoạt động trong hàng đợi.",
        409,
        "ACTIVE_QUEUE_EXISTS",
      );
    }
    throw new AppError(error.message, 500, "DB_ERROR");
  }
  return data;
}

async function updateById(queueId, payload, expectedStatus) {
  let query = supabase
    .from("queue")
    .update(payload)
    .eq("id", queueId);
  if (expectedStatus) query = query.eq("status", expectedStatus);
  const { data, error } = await query.select(QUEUE_SELECT).maybeSingle();

  if (error) {
    if (
      error.code === "23505" &&
      error.message?.includes("queue_one_in_progress_per_dentist")
    ) {
      throw new AppError(
        "Nha sĩ đang điều trị một bệnh nhân khác.",
        409,
        "DENTIST_BUSY",
      );
    }
    throw new AppError(error.message, 500, "DB_ERROR");
  }
  return data;
}

function findDentistInProgress(dentistId, excludedQueueId) {
  let query = supabase
    .from("queue")
    .select("id, patient_id")
    .eq("dentist_id", dentistId)
    .eq("status", "IN_PROGRESS")
    .limit(1);

  if (excludedQueueId) query = query.neq("id", excludedQueueId);
  return query.maybeSingle();
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

async function createTreatmentRecord(payload) {
  const { data, error } = await supabase
    .from("queue_treatment_record")
    .insert(payload)
    .select(
      "record_id, queue_id, patient_id, dentist_id, clinical_examination, diagnosis, treatment_note, post_treatment_instructions, created_at",
    )
    .single();
  if (error) {
    if (error.code === "23505") {
      throw new AppError(
        "Lượt walk-in đã có kết quả điều trị.",
        409,
        "TREATMENT_EXISTS",
      );
    }
    throw new AppError(error.message, 500, "DB_ERROR");
  }
  return data;
}

async function removeTreatmentRecord(recordId) {
  await supabase
    .from("queue_treatment_record")
    .delete()
    .eq("record_id", recordId);
}

module.exports = {
  createFollowUp,
  createTreatmentRecord,
  createWalkIn,
  findAll,
  findById,
  findActiveByPatientId,
  findDentistById,
  findDentistInProgress,
  findPatientById,
  removeTreatmentRecord,
  updateById,
};
