const supabase = require("../../config/supabase");
const AppError = require("../../utils/AppError");

async function getWorkingHour() {
    const { data, error } = await supabase
        .from("clinic_working_hour")
        .select("*")
        .in("status", ["Active", "Scheduled"])
        .order("day_of_week")
        .order("start_time");

    if (error) throw new AppError(error.message, 500, "DB_ERROR");

    const rows = data || [];
    return {
        current: rows.filter((r) => r.is_default),
        pending: rows.filter((r) => !r.is_default && r.effective_date),
    };
}

async function getClinicSetting() {
    const { data, error } = await supabase
        .from("clinic_setting")
        .select("*")
        .in("status", ["Active", "Scheduled"])
        .order("setting_id");

    if (error) throw new AppError(error.message, 500, "DB_ERROR");

    const rows = data || [];
    return {
        current: rows.find((r) => r.is_default) || rows[0] || {},
        pending: rows.find((r) => !r.is_default && r.effective_date) || null,
    };
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

async function countBookedWorkSlots() {
    const { count, error } = await supabase
        .from("work_slot")
        .select("*", { count: "exact", head: true })
        .eq("status", "Booked");

    if (error) throw new AppError(error.message, 500, "DB_ERROR");
    return count || 0;
}

async function getLastBookedSlotDate() {
    const { data, error } = await supabase
        .from("work_slot")
        .select("slot_id, schedules:schedule_id!inner ( work_date )")
        .eq("status", "Booked")
        .limit(500);

    if (error) throw new AppError(error.message, 500, "DB_ERROR");
    if (!data || data.length === 0) return null;

    const dates = data
        .map((row) => row.schedules?.work_date)
        .filter(Boolean)
        .sort();

    return dates.length > 0 ? dates[dates.length - 1] : null;
}

async function deleteAllWorkingHours() {
    const { error } = await supabase
        .from("clinic_working_hour")
        .delete()
        .eq("is_default", true);

    if (error) throw new AppError(error.message, 500, "DB_ERROR");
}

async function insertWorkingHours(hours) {
    if (!hours || hours.length === 0) return [];

    const rows = hours.map((h) => ({
        day_of_week: h.day_of_week,
        start_time: h.start_time,
        end_time: h.end_time,
        is_default: true,
        status: "Active",
    }));

    const { data, error } = await supabase
        .from("clinic_working_hour")
        .insert(rows)
        .select();

    if (error) {
        if (error.code === "23514") {
            throw new AppError(error.message || "Invalid data: a database constraint was violated.", 400, "VALIDATION_ERROR");
        }
        throw new AppError(error.message, 500, "DB_ERROR");
    }
    return data || [];
}

async function insertWorkingHourOverrides(rows) {
    if (!rows || rows.length === 0) return [];

    const payload = rows.map((r) => ({
        day_of_week: r.day_of_week,
        start_time: r.start_time,
        end_time: r.end_time,
        effective_date: r.effective_date,
        is_default: false,
        status: "Scheduled",
    }));

    const { data, error } = await supabase
        .from("clinic_working_hour")
        .insert(payload)
        .select();

    if (error) {
        if (error.code === "23514") {
            throw new AppError(error.message || "Invalid data: a database constraint was violated.", 400, "VALIDATION_ERROR");
        }
        throw new AppError(error.message, 500, "DB_ERROR");
    }
    return data || [];
}

async function deletePendingWorkingHours() {
    const { error } = await supabase
        .from("clinic_working_hour")
        .delete()
        .eq("is_default", false);

    if (error) throw new AppError(error.message, 500, "DB_ERROR");
}

async function insertClinicSetting(fields) {
    const { data, error } = await supabase
        .from("clinic_setting")
        .insert({ ...fields, is_default: true, status: "Active" })
        .select()
        .single();

    if (error) throw new AppError(error.message, 500, "DB_ERROR");
    return data;
}

async function updateClinicSetting(settingId, fields) {
    const { data, error } = await supabase
        .from("clinic_setting")
        .update(fields)
        .eq("setting_id", settingId)
        .select()
        .single();

    if (error) throw new AppError(error.message, 500, "DB_ERROR");
    return data;
}

async function upsertClinicSettingOverride(fields, effectiveDate) {
    const { data: existing } = await supabase
        .from("clinic_setting")
        .select("setting_id")
        .eq("is_default", false)
        .eq("status", "Scheduled")
        .limit(1)
        .single();

    if (existing) {
        const { data, error } = await supabase
            .from("clinic_setting")
            .update({ ...fields, effective_date: effectiveDate })
            .eq("setting_id", existing.setting_id)
            .select()
            .single();

        if (error) throw new AppError(error.message, 500, "DB_ERROR");
        return data;
    }

    const { data, error } = await supabase
        .from("clinic_setting")
        .insert({ ...fields, effective_date: effectiveDate, is_default: false, status: "Scheduled" })
        .select()
        .single();

    if (error) throw new AppError(error.message, 500, "DB_ERROR");
    return data;
}

async function deletePendingClinicSetting() {
    const { error } = await supabase
        .from("clinic_setting")
        .delete()
        .eq("is_default", false);

    if (error) throw new AppError(error.message, 500, "DB_ERROR");
}

module.exports = {
    getWorkingHour,
    getClinicSetting,
    getClosures,
    createClosure,
    deleteClosure,
    countBookedWorkSlots,
    getLastBookedSlotDate,
    deleteAllWorkingHours,
    insertWorkingHours,
    insertWorkingHourOverrides,
    deletePendingWorkingHours,
    insertClinicSetting,
    updateClinicSetting,
    upsertClinicSettingOverride,
    deletePendingClinicSetting,
};
