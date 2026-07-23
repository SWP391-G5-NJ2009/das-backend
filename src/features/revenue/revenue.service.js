const revenueDao = require("./revenue.dao");

async function currentMonthRevenue() {
    return revenueDao.currentMonthRevenue();
}

async function revenueByMonth(mCurrent, mOffset) {
    return revenueDao.revenueByMonth(mCurrent, mOffset);
}

module.exports = {
    currentMonthRevenue,
    revenueByMonth,
}