const supabase = require("../../config/supabase");
const AppError = require("../../utils/AppError");

async function getWorkingHour() {
    const { data, error } = await supabase
        .from("clinic_working_hour")
        .select("*")
        .order("working_hour_id");

    if (error) throw new AppError(error.message, 500, "DB_ERROR");
    return data || [];
}

module.exports = {
    getWorkingHour,
};