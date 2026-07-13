const revenueService = require("./revenue.service");
const { sendSuccess } = require("../../utils/response");

async function revenueAnalytics(req, res, next) {
    try {
        const data = await revenueService.currentMonthRevenue();
        return sendSuccess(res, 200, data, "Lấy doanh thu tháng hiện tại thành công.");
    } catch (err) {
        return next(err);
    }
}

async function monthlyRevenueAnalytics(req, res, next) {
    try {
        const data = await revenueService.revenueByMonth();
        return sendSuccess(res, 200, data, "Lấy doanh thu 12 tháng gần nhất thành công.");
    } catch (err) {
        return next(err);
    }
}

module.exports = {
    revenueAnalytics,
    monthlyRevenueAnalytics,
}