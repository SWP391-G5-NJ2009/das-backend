const revenueDao = require("./revenue.dao");

async function currentMonthRevenue() {
    return revenueDao.currentMonthRevenue();
}

async function revenueByMonth() {
    return revenueDao.revenueByMonth();
}

module.exports = {
    currentMonthRevenue,
    revenueByMonth,
}