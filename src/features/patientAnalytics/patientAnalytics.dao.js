const supabase = require("../../config/supabase");
const AppError = require("../../utils/AppError");

async function getNewPatient() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const startOfMonth = `${year}-${month}-01`;

    const startOfNextMonth = now.getMonth() + 1 === 12
        ? `${year + 1}-01-01` : `${year}-${String(now.getMonth() + 2).padStart(2, "0")}-01`;

    const { data, error } = await supabase
        .rpc("get_new_patient", {
            p_start: startOfMonth,
            p_end: startOfNextMonth,
        });
    if (error) throw new AppError(error.message, 500, "DB_ERROR");
    return data ?? 0;
}

async function getNoShowRate() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const startOfMonth = `${year}-${month}-01`;

    const startOfNextMonth = now.getMonth() + 1 === 12
        ? `${year + 1}-01-01` : `${year}-${String(now.getMonth() + 2).padStart(2, "0")}-01`;

    const { data, error } = await supabase
        .rpc("get_no_show_rate", {
            p_start: startOfMonth,
            p_end: startOfNextMonth,
        });
    if (error) throw new AppError(error.message, 500, "DB_ERROR");
    return data ?? 0.0;
}

async function getReturningPatient() {
    const now = new Date();
    const threeYearsAgo = new Date(now);
    threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

    const p_start = threeYearsAgo.toISOString().slice(0, 10);
    const p_end = now.toISOString().slice(0, 10);

    const { data, error } = await supabase
        .rpc("get_returning_patient_count", { p_start, p_end });
    if (error) throw new AppError(error.message, 500, "DB_ERROR");
    return data ?? 0;
}

async function getMonthlyNewPatient() {
    const { data, error } = await supabase
        .rpc('get_monthly_new_patient', { p_months: 12 });
    if (error) throw new AppError(error.message, 500, "DB_ERROR");
    return data ?? [];
}

module.exports = {
    getNewPatient,
    getNoShowRate,
    getReturningPatient,
    getMonthlyNewPatient,
};