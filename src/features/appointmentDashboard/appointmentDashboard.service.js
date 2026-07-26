const appointmentDashboardDao = require("./appointmentDashboard.dao");
const AppError = require("../../utils/AppError");

async function getMonthlyCounts(year, month) {
  const y = Number(year);
  const m = Number(month);

  if (!y || !m || m < 1 || m > 12) {
    throw new AppError("Năm hoặc tháng không hợp lệ.", 400, "VALIDATION_ERROR");
  }

  return appointmentDashboardDao.countAppointmentsByDay(y, m);
}

async function getDailyAppointments(date) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new AppError("Định dạng ngày không hợp lệ. Vui lòng dùng YYYY-MM-DD.", 400, "VALIDATION_ERROR");
  }

  const appointments = await appointmentDashboardDao.findAppointmentsByDate(date);

  const timeSlots = [];
  const START_MIN = 7 * 60 + 30;
  const END_MIN = 18 * 60; 

  for (let min = START_MIN; min < END_MIN; min += 30) {
    const h1 = Math.floor(min / 60);
    const m1 = min % 60;
    const min2 = min + 30;
    const h2 = Math.floor(min2 / 60);
    const m2 = min2 % 60;

    const start = `${String(h1).padStart(2, "0")}:${String(m1).padStart(2, "0")}`;
    const end = `${String(h2).padStart(2, "0")}:${String(m2).padStart(2, "0")}`;

    timeSlots.push({
      start,
      end,
      label: `${start} - ${end}`,
      appointments: appointments.filter((a) => a.start_time === start),
    });
  }

  return {
    date,
    totalAppointments: appointments.length,
    timeSlots,
    appointments,
  };
}

module.exports = {
  getMonthlyCounts,
  getDailyAppointments,
};
