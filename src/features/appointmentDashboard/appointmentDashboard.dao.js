const supabase = require("../../config/supabase");

function getMonthBounds(year, month) {
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  return { startDate, endDate };
}

async function countAppointmentsByDay(year, month) {
  const { startDate, endDate } = getMonthBounds(year, month);

  const { data, error } = await supabase
    .from("work_slot")
    .select(`
      slot_id,
      schedules:schedule_id (
        work_date
      ),
      appointment_slot (
        appt_id
      )
    `)
    .eq("status", "Booked");

  if (error) throw error;

  const counts = {};
  for (let d = 1; d <= new Date(year, month, 0).getDate(); d++) {
    const dateStr = `${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    counts[dateStr] = 0;
  }

  const dayAppts = {};
  Object.keys(counts).forEach((d) => {
    dayAppts[d] = new Set();
  });

  (data || []).forEach((slot) => {
    const workDate = slot.schedules?.work_date;
    if (!workDate || !dayAppts[workDate]) return;
    (slot.appointment_slot || []).forEach((as) => {
      dayAppts[workDate].add(as.appt_id);
    });
  });

  Object.keys(counts).forEach((d) => {
    counts[d] = dayAppts[d].size;
  });

  return Object.entries(counts).map(([date, count]) => ({ date, count }));
}

async function findAppointmentsByDate(date) {
  const { data, error } = await supabase
    .from("work_slot")
    .select(`
      slot_id,
      status,
      time_slot_config:slot_config_id (
        start_time,
        end_time
      ),
      schedules:schedule_id (
        work_date,
        dentist:dentist_id (
          dentist_id,
          full_name
        )
      ),
      appointment_slot (
        is_primary,
        appointment:appt_id (
          appt_id,
          status,
          note,
          total_estimated_amount,
          book_time,
          patient:patient_id (
            patient_id,
            full_name,
            phone
          ),
          appointment_service (
            dental_service:service_id (
              service_name
            )
          )
        )
      )
    `)
    .eq("status", "Booked");

  if (error) throw error;

  const appointments = [];

  (data || []).forEach((slot) => {
    const workDate = slot.schedules?.work_date;
    if (workDate !== date) return;

    const apptSlot = (slot.appointment_slot || []).find((as) => as.is_primary);
    const appt = apptSlot?.appointment;
    if (!appt) return;

    const startTime = slot.time_slot_config?.start_time?.substring(0, 5) || "";
    const endTime = slot.time_slot_config?.end_time?.substring(0, 5) || "";
    const dentistName = slot.schedules?.dentist?.full_name || "Unassigned";
    const roomName = slot.schedules?.room_info?.room_name || "";
    const patientName = appt.patient?.full_name || "Unknown";
    const patientPhone = appt.patient?.phone || "";
    const services = (appt.appointment_service || [])
      .map((s) => s.dental_service?.service_name)
      .filter(Boolean);

    appointments.push({
      appt_id: appt.appt_id,
      status: appt.status,
      note: appt.note,
      start_time: startTime,
      end_time: endTime,
      dentist_name: dentistName,
      room_name: roomName,
      patient_name: patientName,
      patient_phone: patientPhone,
      services,
      total_estimated_amount: appt.total_estimated_amount,
    });
  });

  return appointments.sort((a, b) => a.start_time.localeCompare(b.start_time));
}

module.exports = {
  countAppointmentsByDay,
  findAppointmentsByDate,
};
