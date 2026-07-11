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

async function getClinicSetting() {
    const { data, error } = await supabase
        .from("clinic_setting")
        .select("*")
        .order("setting_id")
        .limit(1)
        .single();

    if (error) throw new AppError(error.message, 500, "DB_ERROR");
    return data || {};
}

async function getClosures() {
    const { data, error } = await supabase
        .from("clinic_closure")
        .select("*")
        .order("closure_date");

    if (error) throw new AppError(error.message, 500, "DB_ERROR");
    return data || [];
}

async function createClosure(closureDate, reason) {
    const { data, error } = await supabase
        .from("clinic_closure")
        .insert({ closure_date: closureDate, reason: reason || null })
        .select()
        .single();

    if (error) {
        if (error.code === "23505") {
            throw new AppError("This date is already marked as a closure.", 409, "DUPLICATE_CLOSURE");
        }
        throw new AppError(error.message, 500, "DB_ERROR");
    }
    return data;
}

async function deleteClosure(closureId) {
    const { data, error } = await supabase
        .from("clinic_closure")
        .delete()
        .eq("closure_id", closureId)
        .select()
        .single();

    if (error) throw new AppError(error.message, 500, "DB_ERROR");
    if (!data) throw new AppError("Closure not found.", 404, "NOT_FOUND");
    return data;
}

module.exports = {
    getWorkingHour,
    getClinicSetting,
    getClosures,
    createClosure,
    deleteClosure,
};