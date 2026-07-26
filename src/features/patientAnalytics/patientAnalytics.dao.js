const supabase = require("../../config/supabase");
const AppError = require("../../utils/AppError");

async function getNewPatient() {
    const { data, error } = await supabase
        .rpc("get_new_patient_count");
    if (error) throw new AppError(error.message, 500, "DB_ERROR");
    return data ?? 0;
}

async function getNoShowRate() {
    const { data, error } = await supabase
        .rpc("get_no_show_rate");
    if (error) throw new AppError(error.message, 500, "DB_ERROR");
    return data ?? 0.0;
}

async function getReturningPatient() {
    const { data, error } = await supabase
        .rpc("get_returning_patient_count");
    if (error) throw new AppError(error.message, 500, "DB_ERROR");
    return data ?? 0;
}

async function getMonthlyNewPatient(mCurrent, mOffset) {
    const { data, error } = await supabase
        .rpc('get_monthly_new_patient', { p_current: mCurrent, p_offset: mOffset });
    if (error) throw new AppError(error.message, 500, "DB_ERROR");
    return data ?? [];
}

async function getMonthlyReturningPatient(mCurrent, mOffset) {
    const { data, error } = await supabase
        .rpc('get_monthly_returning_patient', { p_current: mCurrent, p_offset: mOffset });
    if (error) throw new AppError(error.message, 500, "DB_ERROR");
    return data ?? [];
}

async function getMonthlyNoShowRate() {
    const { data, error } = await supabase
        .rpc('get_monthly_no_show_rate', { p_months: 12 });
    if (error) throw new AppError(error.message, 500, "DB_ERROR");
    return data ?? [];
}

module.exports = {
    getNewPatient,
    getNoShowRate,
    getReturningPatient,
    getMonthlyNewPatient,
    getMonthlyReturningPatient,
    getMonthlyNoShowRate,
};