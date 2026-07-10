const revenueService = require("./revenue.service");
const { sendSuccess } = require("../../utils/response");

async function revenueAnalytics(req, res, next) {
    try {
        const data = await revenueService.currentMonthRevenue();
        return sendSuccess(res, 200, data, "Current month's revenue retrieved successfully.");
    } catch (err) {
        return next(err);
    }
}

async function monthlyRevenueAnalytics(req, res, next) {
    try {
        const data = await revenueService.revenueByMonth();
        return sendSuccess(res, 200, data, "The last 12 months' revenues retrieved successfully.");
    } catch (err) {
        return next(err);
    }
}

module.exports = {
    revenueAnalytics,
    monthlyRevenueAnalytics,
}