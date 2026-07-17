const supabase = require("../../config/supabase");

const SCHEDULE_SELECT = `
  schedule_id,
  dentist_id,
  work_date,
  status,
  dentist:dentist_id (
    dentist_id,
    full_name,
    speciality,
    email,
    phone
  ),
  work_slot (
    slot_id,
    slot_config_id,
    status,
    time_slot_config:slot_config_id (
      slot_config_id,
      start_time,
      end_time,
      version_id,
      day_of_week
    )
  )
`.trim();

function findTimeSlotConfigs() {
  return supabase
    .from("time_slot_config")
    .select("slot_config_id, slot_name, start_time, end_time, version_id, day_of_week")
    .order("day_of_week", { ascending: true })
    .order("slot_config_id", { ascending: true });
}

function findTimeSlotConfigsByVersion(versionId) {
  return supabase
    .from("time_slot_config")
    .select("slot_config_id, slot_name, start_time, end_time, version_id, day_of_week")
    .eq("version_id", versionId)
    .order("day_of_week", { ascending: true })
    .order("slot_config_id", { ascending: true });
}

function findWorkingHoursByVersion(versionId) {
  return supabase
    .from("clinic_working_hour")
    .select("working_hour_id, version_id, day_of_week, start_time, end_time")
    .eq("version_id", versionId)
    .order("day_of_week", { ascending: true })
    .order("start_time", { ascending: true });
}

function findTimeSlotConfigsByVersionAndDay(versionId, dayOfWeek) {
  return supabase
    .from("time_slot_config")
    .select("slot_config_id, slot_name, start_time, end_time, version_id, day_of_week")
    .eq("version_id", versionId)
    .eq("day_of_week", dayOfWeek)
    .order("slot_config_id", { ascending: true });
}

function findClinicScheduleVersionForDate(workDate) {
  return supabase
    .from("clinic_schedule_version")
    .select("version_id, name, effective_date, status")
    .in("status", ["Active", "Pending"])
    .lte("effective_date", workDate)
    .order("effective_date", { ascending: false })
    .limit(1)
    .maybeSingle();
}

function findClinicInfo() {
  return supabase
    .from("clinic_info")
    .select("open_time, close_time")
    .limit(1)
    .maybeSingle();
}

function findAvailableRooms() {
  return supabase
    .from("room_info")
    .select("room_id, room_name, dentist_id, status")
    .in("status", ["Available", "Active"])
    .order("room_name", { ascending: true });
}

function findDentistByAccountId(accountId) {
  return supabase
    .from("dentist")
    .select("dentist_id, full_name, speciality, email, phone")
    .eq("account_id", accountId)
    .maybeSingle();
}

function findSchedulesByDentist(dentistId, { dateFrom, dateTo } = {}) {
  let query = supabase
    .from("schedules")
    .select(SCHEDULE_SELECT)
    .eq("dentist_id", dentistId)
    .order("work_date", { ascending: true });

  if (dateFrom) query = query.gte("work_date", dateFrom);
  if (dateTo) query = query.lte("work_date", dateTo);

  return query;
}

function findSchedulesForOwner({ dateFrom, dateTo, status } = {}) {
  let query = supabase
    .from("schedules")
    .select(SCHEDULE_SELECT)
    .order("work_date", { ascending: true });

  if (dateFrom) query = query.gte("work_date", dateFrom);
  if (dateTo) query = query.lte("work_date", dateTo);

  if (status === "Pending") {
    query = query.eq("status", "Pending");
  } else if (status === "Scheduled") {
    query = query.eq("status", "Scheduled");
  } else if (status === "Denied") {
    query = query.ilike("status", "Denied%");
  }

  return query;
}

function findScheduleById(scheduleId) {
  return supabase
    .from("schedules")
    .select(SCHEDULE_SELECT)
    .eq("schedule_id", scheduleId)
    .maybeSingle();
}

function findScheduleByDentistAndDate(dentistId, workDate) {
  return supabase
    .from("schedules")
    .select(SCHEDULE_SELECT)
    .eq("dentist_id", dentistId)
    .eq("work_date", workDate)
    .maybeSingle();
}

function findWorkSlotsByIdsForDentist(slotIds, dentistId) {
  return supabase
    .from("work_slot")
    .select(
      `
      slot_id,
      schedule_id,
      slot_config_id,
      status,
      time_slot_config:slot_config_id (
        start_time,
        end_time
      ),
      schedules:schedule_id!inner (
        schedule_id,
        work_date,
        status,
        dentist_id
      )
    `,
    )
    .in("slot_id", slotIds)
    .eq("schedules.dentist_id", dentistId);
}

function findWorkSlotsByScheduleId(scheduleId) {
  return supabase
    .from("work_slot")
    .select(
      `
      slot_id,
      schedule_id,
      slot_config_id,
      status,
      time_slot_config:slot_config_id (
        start_time,
        end_time
      )
    `,
    )
    .eq("schedule_id", scheduleId);
}

function findAffectedAppointmentsBySlotIds(slotIds) {
  return supabase
    .from("appointment_slot")
    .select(
      `
      slot_id,
      work_slot:slot_id (
        time_slot_config:slot_config_id (
          start_time,
          end_time
        ),
        schedules:schedule_id (
          work_date
        )
      ),
      appointment:appt_id!inner (
        appt_id,
        status,
        note,
        patient:patient_id (
          patient_id,
          full_name,
          phone,
          email
        ),
        appointment_service (
          dental_service:service_id (
            service_name
          )
        )
      )
    `,
    )
    .in("slot_id", slotIds)
    .eq("appointment.status", "Confirmed");
}

function insertSchedule(payload) {
  return supabase.from("schedules").insert([payload]).select(SCHEDULE_SELECT);
}

function updateSchedule(scheduleId, payload) {
  return supabase
    .from("schedules")
    .update(payload)
    .eq("schedule_id", scheduleId)
    .select(SCHEDULE_SELECT);
}

function deleteEditableWorkSlots(scheduleId) {
  return supabase
    .from("work_slot")
    .delete()
    .eq("schedule_id", scheduleId)
    .neq("status", "Booked")
    .select("slot_id");
}

function insertWorkSlots(rows) {
  if (!rows.length) return Promise.resolve({ data: [], error: null });

  return supabase
    .from("work_slot")
    .insert(rows)
    .select("slot_id, schedule_id, slot_config_id, status");
}

function updateWorkSlotsStatus(scheduleId, status) {
  return supabase
    .from("work_slot")
    .update({ status })
    .eq("schedule_id", scheduleId)
    .neq("status", "Booked")
    .select("slot_id, status");
}

function updateWorkSlotsByIds(slotIds, status) {
  return supabase
    .from("work_slot")
    .update({ status })
    .in("slot_id", slotIds)
    .select("slot_id, status");
}

function updateAppointmentsToConflict(apptIds, reason) {
  const note = reason
    ? `Conflict: Dentist unavailable. ${reason}`
    : "Conflict: Dentist unavailable.";

  return supabase
    .from("appointment")
    .update({ status: "Conflict", note })
    .in("appt_id", apptIds)
    .eq("status", "Confirmed")
    .select("appt_id, status, note");
}

function countBookedWorkSlots(scheduleId) {
  return supabase
    .from("work_slot")
    .select("slot_id", { count: "exact", head: true })
    .eq("schedule_id", scheduleId)
    .eq("status", "Booked");
}

module.exports = {
  countBookedWorkSlots,
  deleteEditableWorkSlots,
  findAvailableRooms,
  findAffectedAppointmentsBySlotIds,
  findClinicScheduleVersionForDate,
  findClinicInfo,
  findDentistByAccountId,
  findScheduleByDentistAndDate,
  findScheduleById,
  findSchedulesByDentist,
  findSchedulesForOwner,
  findTimeSlotConfigs,
  findTimeSlotConfigsByVersion,
  findTimeSlotConfigsByVersionAndDay,
  findWorkingHoursByVersion,
  findWorkSlotsByIdsForDentist,
  findWorkSlotsByScheduleId,
  insertSchedule,
  insertWorkSlots,
  updateAppointmentsToConflict,
  updateSchedule,
  updateWorkSlotsByIds,
  updateWorkSlotsStatus,
};
