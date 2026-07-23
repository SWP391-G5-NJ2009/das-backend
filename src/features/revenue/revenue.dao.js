const supabase = require("../../config/supabase");
const AppError = require("../../utils/AppError");

async function currentMonthRevenue() {

    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const startOfMonth = `${year}-${month}-01`;

    const startOfNextMonth = now.getMonth() + 1 === 12
        ? `${year + 1}-01-01` : `${year}-${String(now.getMonth() + 2).padStart(2, "0")}-01`;

    const { data, error } = await supabase
        .from("payment")
        .select("amount")
        .gte("payment_date", startOfMonth)
        .lt("payment_date", startOfNextMonth)
    if (error) throw new AppError(error.message, 500, "DB_ERROR");
    return data ?? 0;
}

async function revenueByMonth() {
    const { data, error } = await supabase
        .rpc('get_monthly_revenue', { p_months: 12 });
    if (error) throw new AppError(error.message, 500, "DB_ERROR");
    return data ?? [];
}

module.exports = {
    currentMonthRevenue,
    revenueByMonth,
};