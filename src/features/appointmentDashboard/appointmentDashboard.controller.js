const appointmentDashboardService = require("./appointmentDashboard.service");
const { sendSuccess } = require("../../utils/response");

async function getMonthlyCounts(req, res, next) {
  try {
    const { year, month } = req.query;
    const data = await appointmentDashboardService.getMonthlyCounts(year, month);
    return sendSuccess(res, 200, data, "Lấy số lượng lịch hẹn theo tháng thành công.");
  } catch (error) {
    return next(error);
  }
}

async function getDailyAppointments(req, res, next) {
  try {
    const { date } = req.query;
    const data = await appointmentDashboardService.getDailyAppointments(date);
    return sendSuccess(res, 200, data, "Lấy lịch hẹn theo ngày thành công.");
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getMonthlyCounts,
  getDailyAppointments,
};
