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
  for (let h = 8; h < 18; h++) {
    const startLabel = `${String(h).padStart(2, "0")}:00`;
    const endLabel = `${String(h).padStart(2, "0")}:30`;
    const startLabel2 = `${String(h).padStart(2, "0")}:30`;
    const endLabel2 = `${String(h + 1).padStart(2, "0")}:00`;

    timeSlots.push({
      start: startLabel,
      end: endLabel,
      label: `${startLabel} - ${endLabel}`,
      appointments: appointments.filter((a) => a.start_time === startLabel),
    });

    if (h < 17) {
      timeSlots.push({
        start: startLabel2,
        end: endLabel2,
        label: `${startLabel2} - ${endLabel2}`,
        appointments: appointments.filter((a) => a.start_time === startLabel2),
      });
    }
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
