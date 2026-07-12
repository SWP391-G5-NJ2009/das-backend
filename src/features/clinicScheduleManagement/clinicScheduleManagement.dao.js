const supabase = require("../../config/supabase");
const AppError = require("../../utils/AppError");

// ── Version Queries ──────────────────────────────────────────────

async function getActiveVersion() {
    const { data, error } = await supabase
        .from("clinic_working_hour_version")
        .select("*")
        .eq("status", "Active")
        .order("effective_date", { ascending: false })
        .limit(1)
        .maybeSingle();

    if (error) throw new AppError(error.message, 500, "DB_ERROR");
    return data;
}

async function getPendingVersion() {
    const { data, error } = await supabase
        .from("clinic_working_hour_version")
        .select("*")
        .eq("status", "Pending")
        .order("effective_date")
        .limit(1)
        .maybeSingle();

    if (error) throw new AppError(error.message, 500, "DB_ERROR");
    return data;
}

async function getAllVersions() {
    const { data, error } = await supabase
        .from("clinic_working_hour_version")
        .select("*")
        .order("effective_date", { ascending: false });

    if (error) throw new AppError(error.message, 500, "DB_ERROR");
    return data || [];
}

async function createVersion(name, effectiveDate, status) {
    const { data, error } = await supabase
        .from("clinic_working_hour_version")
        .insert({ name: name || null, effective_date: effectiveDate, status })
        .select()
        .single();

    if (error) {
        if (error.code === "23514") {
            throw new AppError(error.message || "Invalid data: a database constraint was violated.", 400, "VALIDATION_ERROR");
        }
        throw new AppError(error.message, 500, "DB_ERROR");
    }
    return data;
}

async function createSettingVersion(name, effectiveDate, status) {
    const { data, error } = await supabase
        .from("clinic_setting_version")
        .insert({ name: name || null, effective_date: effectiveDate, status })
        .select()
        .single();

    if (error) throw new AppError(error.message, 500, "DB_ERROR");
    return data;
}

async function activateVersion(versionId) {
    const { data, error } = await supabase
        .from("clinic_working_hour_version")
        .update({ status: "Active" })
        .eq("version_id", versionId)
        .select()
        .single();

    if (error) throw new AppError(error.message, 500, "DB_ERROR");
    return data;
}

async function activateSettingVersion(versionId) {
    const { data, error } = await supabase
        .from("clinic_setting_version")
        .update({ status: "Active" })
        .eq("version_id", versionId)
        .select()
        .single();

    if (error) throw new AppError(error.message, 500, "DB_ERROR");
    return data;
}

async function expireAllActiveVersions() {
    const { error: e1 } = await supabase
        .from("clinic_working_hour_version")
        .update({ status: "Expired" })
        .eq("status", "Active");

    if (e1) throw new AppError(e1.message, 500, "DB_ERROR");

    const { error: e2 } = await supabase
        .from("clinic_setting_version")
        .update({ status: "Expired" })
        .eq("status", "Active");

    if (e2) throw new AppError(e2.message, 500, "DB_ERROR");
}

async function deletePendingVersions() {
    const { data: pendingWHVersions, error: fetchErr } = await supabase
        .from("clinic_working_hour_version")
        .select("version_id")
        .eq("status", "Pending");

    if (fetchErr) throw new AppError(fetchErr.message, 500, "DB_ERROR");

    const pendingVersionIds = (pendingWHVersions || []).map((v) => v.version_id);

    if (pendingVersionIds.length > 0) {
        const { error: e0 } = await supabase
            .from("clinic_working_hour")
            .delete()
            .in("version_id", pendingVersionIds);
        if (e0) throw new AppError(e0.message, 500, "DB_ERROR");

        const { error: e1 } = await supabase
            .from("clinic_setting")
            .delete()
            .in("version_id", pendingVersionIds);
        if (e1) throw new AppError(e1.message, 500, "DB_ERROR");
    }

    const { data: deletedWH, error: e2 } = await supabase
        .from("clinic_working_hour_version")
        .delete()
        .eq("status", "Pending")
        .select("version_id");
    if (e2) throw new AppError(e2.message, 500, "DB_ERROR");

    const { data: deletedCS, error: e3 } = await supabase
        .from("clinic_setting_version")
        .delete()
        .eq("status", "Pending")
        .select("version_id");
    if (e3) throw new AppError(e3.message, 500, "DB_ERROR");

    return { deletedWHVersions: deletedWH || [], deletedCSVersions: deletedCS || [] };
}

async function deleteVersionById(versionId) {
    const { error: e1 } = await supabase
        .from("clinic_working_hour")
        .delete()
        .eq("version_id", versionId);
    if (e1) throw new AppError(e1.message, 500, "DB_ERROR");

    const { error } = await supabase
        .from("clinic_working_hour_version")
        .delete()
        .eq("version_id", versionId);

    if (error) throw new AppError(error.message, 500, "DB_ERROR");
}

async function deleteSettingVersionById(versionId) {
    const { error: e1 } = await supabase
        .from("clinic_setting")
        .delete()
        .eq("version_id", versionId);
    if (e1) throw new AppError(e1.message, 500, "DB_ERROR");

    const { error } = await supabase
        .from("clinic_setting_version")
        .delete()
        .eq("version_id", versionId);

    if (error) throw new AppError(error.message, 500, "DB_ERROR");
}

async function getPendingVersionsDueForActivation() {
    const today = new Date().toISOString().slice(0, 10);

    const { data, error } = await supabase
        .from("clinic_working_hour_version")
        .select("*")
        .eq("status", "Pending")
        .lte("effective_date", today);

    if (error) throw new AppError(error.message, 500, "DB_ERROR");
    return data || [];
}

// ── Working Hour Queries ─────────────────────────────────────────

async function getWorkingHourByVersionId(versionId) {
    const { data, error } = await supabase
        .from("clinic_working_hour")
        .select("*")
        .eq("version_id", versionId)
        .order("day_of_week")
        .order("start_time");

    if (error) throw new AppError(error.message, 500, "DB_ERROR");
    return data || [];
}

async function getWorkingHour() {
    const activeVersion = await getActiveVersion();
    const pendingVersion = await getPendingVersion();

    const activeHours = activeVersion
        ? await getWorkingHourByVersionId(activeVersion.version_id)
        : [];
    const pendingHours = pendingVersion
        ? await getWorkingHourByVersionId(pendingVersion.version_id)
        : [];

    return {
        active: { version: activeVersion, hours: activeHours },
        pending: { version: pendingVersion, hours: pendingHours },
    };
}

async function insertWorkingHours(versionId, hours) {
    if (!hours || hours.length === 0) return [];

    const rows = hours.map((h) => ({
        version_id: versionId,
        day_of_week: h.day_of_week,
        start_time: h.start_time,
        end_time: h.end_time,
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

async function deleteWorkingHoursByVersionId(versionId) {
    const { error } = await supabase
        .from("clinic_working_hour")
        .delete()
        .eq("version_id", versionId);

    if (error) throw new AppError(error.message, 500, "DB_ERROR");
}

async function replaceWorkingHours(versionId, hours) {
    await deleteWorkingHoursByVersionId(versionId);
    return insertWorkingHours(versionId, hours);
}

// ── Clinic Setting Queries ───────────────────────────────────────

async function getClinicSettingByVersionId(versionId) {
    const { data, error } = await supabase
        .from("clinic_setting")
        .select("*")
        .eq("version_id", versionId)
        .order("setting_id")
        .limit(1)
        .maybeSingle();

    if (error) throw new AppError(error.message, 500, "DB_ERROR");
    return data;
}

async function getClinicSetting() {
    const activeVersion = await getActiveVersion();
    const pendingVersion = await getPendingVersion();

    const activeSetting = activeVersion
        ? await getClinicSettingByVersionId(activeVersion.version_id)
        : null;
    const pendingSetting = pendingVersion
        ? await getClinicSettingByVersionId(pendingVersion.version_id)
        : null;

    return {
        active: { version: activeVersion, setting: activeSetting },
        pending: { version: pendingVersion, setting: pendingSetting },
    };
}

async function insertClinicSetting(versionId, fields) {
    const { data, error } = await supabase
        .from("clinic_setting")
        .insert({ ...fields, version_id: versionId })
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

async function deleteClinicSettingByVersionId(versionId) {
    const { error } = await supabase
        .from("clinic_setting")
        .delete()
        .eq("version_id", versionId);

    if (error) throw new AppError(error.message, 500, "DB_ERROR");
}

async function replaceClinicSetting(versionId, fields) {
    await deleteClinicSettingByVersionId(versionId);
    return insertClinicSetting(versionId, fields);
}

// ── Closure Queries ──────────────────────────────────────────────

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

// ── Work Slot Queries ────────────────────────────────────────────

async function countBookedWorkSlots() {
    const { count, error } = await supabase
        .from("work_slot")
        .select("*", { count: "exact", head: true })
        .eq("status", "Booked");

    if (error) throw new AppError(error.message, 500, "DB_ERROR");
    return count || 0;
}

async function getLastBookedSlotDate() {
    const { data: bookedSlots, error: slotErr } = await supabase
        .from("work_slot")
        .select("slot_id, schedule_id")
        .eq("status", "Booked")
        .limit(500);

    if (slotErr) throw new AppError(slotErr.message, 500, "DB_ERROR");
    if (!bookedSlots || bookedSlots.length === 0) return null;

    const scheduleIds = [...new Set(bookedSlots.map((s) => s.schedule_id).filter(Boolean))];
    if (scheduleIds.length === 0) return null;

    const { data: schedules, error: schedErr } = await supabase
        .from("schedules")
        .select("schedule_id, work_date")
        .in("schedule_id", scheduleIds);

    if (schedErr) throw new AppError(schedErr.message, 500, "DB_ERROR");

    const scheduleMap = {};
    for (const s of schedules || []) scheduleMap[s.schedule_id] = s;

    const dates = bookedSlots
        .map((row) => scheduleMap[row.schedule_id]?.work_date)
        .filter(Boolean)
        .sort();

    return dates.length > 0 ? dates[dates.length - 1] : null;
}

// ── Conflict Detection ──────────────────────────────────────────

async function findConflictingAppointments(newHours) {
    const { data: bookedSlots, error: slotErr } = await supabase
        .from("work_slot")
        .select("slot_id, schedule_id, slot_config_id")
        .eq("status", "Booked");

    if (slotErr) throw new AppError(slotErr.message, 500, "DB_ERROR");
    if (!bookedSlots || bookedSlots.length === 0) return [];

    const configIds = [...new Set(bookedSlots.map((s) => s.slot_config_id).filter(Boolean))];
    const scheduleIds = [...new Set(bookedSlots.map((s) => s.schedule_id).filter(Boolean))];

    const [configResult, scheduleResult] = await Promise.all([
        configIds.length > 0
            ? supabase.from("time_slot_config").select("slot_config_id, start_time, end_time").in("slot_config_id", configIds)
            : { data: [], error: null },
        scheduleIds.length > 0
            ? supabase.from("schedules").select("schedule_id, work_date, dentist_id").in("schedule_id", scheduleIds)
            : { data: [], error: null },
    ]);

    if (configResult.error) throw new AppError(configResult.error.message, 500, "DB_ERROR");
    if (scheduleResult.error) throw new AppError(scheduleResult.error.message, 500, "DB_ERROR");

    const configMap = {};
    for (const c of configResult.data || []) configMap[c.slot_config_id] = c;

    const scheduleMap = {};
    for (const s of scheduleResult.data || []) scheduleMap[s.schedule_id] = s;

    const hoursMap = {};
    for (const h of newHours) {
        if (!hoursMap[h.day_of_week]) hoursMap[h.day_of_week] = [];
        hoursMap[h.day_of_week].push({ start: h.start_time, end: h.end_time });
    }

    const conflicting = [];
    for (const slot of bookedSlots) {
        const config = configMap[slot.slot_config_id];
        const schedule = scheduleMap[slot.schedule_id];
        if (!config || !schedule) continue;

        const workDate = schedule.work_date;
        const slotStart = config.start_time;
        const slotEnd = config.end_time;
        if (!workDate || !slotStart) continue;

        const dateObj = new Date(workDate + "T00:00:00Z");
        const jsDay = dateObj.getUTCDay();
        const dayOfWeek = (jsDay + 6) % 7 + 1;

        const shifts = hoursMap[dayOfWeek] || [];
        const covered = shifts.some(
            (s) => slotStart >= s.start && slotStart < s.end,
        );

        if (!covered) {
            conflicting.push({
                slot_id: slot.slot_id,
                work_date: workDate,
                slot_start: slotStart,
                slot_end: slotEnd || null,
                dentist_id: schedule.dentist_id || null,
            });
        }
    }

    return conflicting;
}

async function markSlotsAsUnavailable(slotIds) {
    if (!slotIds || slotIds.length === 0) return;

    const { error } = await supabase
        .from("work_slot")
        .update({ status: "Unavailable" })
        .in("slot_id", slotIds)
        .eq("status", "Booked");

    if (error) throw new AppError(error.message, 500, "DB_ERROR");
}

async function getVersionById(versionId) {
    const { data, error } = await supabase
        .from("clinic_working_hour_version")
        .select("*")
        .eq("version_id", versionId)
        .maybeSingle();

    if (error) throw new AppError(error.message, 500, "DB_ERROR");
    return data;
}

async function updateEffectiveDate(versionId, effectiveDate) {
    const { error: e1 } = await supabase
        .from("clinic_working_hour_version")
        .update({ effective_date: effectiveDate })
        .eq("version_id", versionId);

    if (e1) throw new AppError(e1.message, 500, "DB_ERROR");

    const { error: e2 } = await supabase
        .from("clinic_setting_version")
        .update({ effective_date: effectiveDate })
        .eq("version_id", versionId);

    if (e2) throw new AppError(e2.message, 500, "DB_ERROR");
}

module.exports = {
    getActiveVersion,
    getPendingVersion,
    getAllVersions,
    createVersion,
    createSettingVersion,
    activateVersion,
    activateSettingVersion,
    expireAllActiveVersions,
    deletePendingVersions,
    deleteVersionById,
    deleteSettingVersionById,
    getPendingVersionsDueForActivation,
    getWorkingHour,
    getWorkingHourByVersionId,
    insertWorkingHours,
    deleteWorkingHoursByVersionId,
    replaceWorkingHours,
    getClinicSetting,
    getClinicSettingByVersionId,
    insertClinicSetting,
    updateClinicSetting,
    deleteClinicSettingByVersionId,
    replaceClinicSetting,
    getClosures,
    createClosure,
    deleteClosure,
    countBookedWorkSlots,
    getLastBookedSlotDate,
    findConflictingAppointments,
    markSlotsAsUnavailable,
    getVersionById,
    updateEffectiveDate,
};
