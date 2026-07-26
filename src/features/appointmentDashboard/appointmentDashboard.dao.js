const supabase = require("../../config/supabase");
const AppError = require("../../utils/AppError");

async function countAppointmentsByDay(year, month) {
  const { data, error } = await supabase.rpc("get_monthly_appointment_counts", {
    p_year: year,
    p_month: month,
  });

  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  return data ?? [];
}

async function findAppointmentsByDate(date) {
  const { data, error } = await supabase.rpc("get_daily_appointments", {
    p_date: date,
  });

  if (error) throw new AppError(error.message, 500, "DB_ERROR");

  return (data || []).map((row) => ({
    appt_id: row.appt_id,
    status: row.status,
    note: row.note,
    start_time: row.start_time,
    end_time: row.end_time,
    dentist_name: row.dentist_name || "Unassigned",
    room_name: "",
    patient_name: row.patient_name || "Unknown",
    patient_phone: row.patient_phone || "",
    services: Array.isArray(row.services)
      ? row.services
      : typeof row.services === "string"
        ? JSON.parse(row.services)
        : [],
    total_estimated_amount: row.total_estimated_amount,
  }));
}

module.exports = {
  countAppointmentsByDay,
  findAppointmentsByDate,
};
