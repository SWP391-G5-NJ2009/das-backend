const supabase = require("../../config/supabase");
const AppError = require("../../utils/AppError");

async function currentMonthRevenue() {
    const { data, error } = await supabase
        .rpc('get_revenue_summary')
        .single();
    if (error) throw new AppError(error.message, 500, "DB_ERROR");
    return data ?? { current_revenue: 0, percentage_change: null };
}

async function revenueByMonth(mCurrent, mOffset) {
    const { data, error } = await supabase
        .rpc('get_monthly_revenue', { m_current: mCurrent, m_offset: mOffset });
    if (error) throw new AppError(error.message, 500, "DB_ERROR");
    return data ?? [];
}

module.exports = {
    currentMonthRevenue,
    revenueByMonth,
};