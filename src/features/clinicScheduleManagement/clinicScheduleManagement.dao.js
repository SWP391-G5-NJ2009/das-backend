const supabase = require("../../config/supabase");
const AppError = require("../../utils/AppError");
const { todayVietnam } = require("../../utils/dateUtils");

async function getAllVersionsWithHours() {
    const { data: versions, error: vErr } = await supabase
        .from("clinic_schedule_version")
        .select("*")
        .order("effective_date", { ascending: false });

    if (vErr) throw new AppError(vErr.message, 500, "DB_ERROR");
    if (!versions || versions.length === 0) return [];

    const versionIds = versions.map((v) => v.version_id);

    const hoursResult = await Promise.all(
        versionIds.map((id) => getWorkingHourByVersionId(id)),
    );

    const counts = versionIds.length > 0
        ? await getWorkSlotCountsByVersionIds(versionIds)
        : {};

    return versions.map((v, i) => ({
        version: {
            ...v,
            hasLinkedWorkSlots: (counts[v.version_id] || 0) > 0,
        },
        hours: hoursResult[i],
    }));
}

async function findVersionByEffectiveDate(effectiveDate, excludeVersionId) {
    let query = supabase
        .from("clinic_schedule_version")
        .select("version_id, name, effective_date")
        .eq("effective_date", effectiveDate);

    if (excludeVersionId) {
        query = query.neq("version_id", excludeVersionId);
    }

    const { data, error } = await query.maybeSingle();

    if (error) throw new AppError(error.message, 500, "DB_ERROR");
    return data;
}

async function createVersion(name, effectiveDate) {
    const { data, error } = await supabase
        .from("clinic_schedule_version")
        .insert({ name: name || null, effective_date: effectiveDate })
        .select()
        .single();

    if (error) {
        if (error.code === "23514") {
            throw new AppError(error.message || "Dữ liệu không hợp lệ: vi phạm ràng buộc cơ sở dữ liệu.", 400, "VALIDATION_ERROR");
        }
        throw new AppError(error.message, 500, "DB_ERROR");
    }
    return data;
}

async function deleteVersionById(versionId) {
    const { error: whErr } = await supabase
        .from("clinic_working_hour")
        .delete()
        .eq("version_id", versionId);

    if (whErr) throw new AppError(whErr.message, 500, "DB_ERROR");

    const { error: tscErr } = await supabase
        .from("time_slot_config")
        .delete()
        .eq("version_id", versionId);

    if (tscErr) throw new AppError(tscErr.message, 500, "DB_ERROR");

    const { data, error: vErr } = await supabase
        .from("clinic_schedule_version")
        .delete()
        .eq("version_id", versionId)
        .select("version_id")
        .single();

    if (vErr) throw new AppError(vErr.message, 500, "DB_ERROR");
    if (!data) throw new AppError("Version not found.", 404, "NOT_FOUND");
    return data;
}

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
    const versions = await getAllVersionsWithHours();
    return { versions };
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
            throw new AppError(error.message || "Dữ liệu không hợp lệ: vi phạm ràng buộc cơ sở dữ liệu.", 400, "VALIDATION_ERROR");
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

async function getTimeSlotConfigsByVersionId(versionId) {
    const { data, error } = await supabase
        .from("time_slot_config")
        .select("*")
        .eq("version_id", versionId);

    if (error) throw new AppError(error.message, 500, "DB_ERROR");
    return data || [];
}

async function replaceTimeSlotConfigs(versionId, configs) {
    const { error: delErr } = await supabase
        .from("time_slot_config")
        .delete()
        .eq("version_id", versionId);

    if (delErr) throw new AppError(delErr.message, 500, "DB_ERROR");

    if (!configs || configs.length === 0) return [];

    const { data, error: insErr } = await supabase
        .from("time_slot_config")
        .insert(configs)
        .select();

    if (insErr) throw new AppError(insErr.message, 500, "DB_ERROR");
    return data || [];
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
            throw new AppError("Ngày này đã được đánh dấu là ngày nghỉ.", 409, "DUPLICATE_CLOSURE");
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
    if (!data) throw new AppError("Không tìm thấy ngày nghỉ.", 404, "NOT_FOUND");
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


async function getVersionById(versionId) {
    const { data, error } = await supabase
        .from("clinic_schedule_version")
        .select("*")
        .eq("version_id", versionId)
        .maybeSingle();

    if (error) throw new AppError(error.message, 500, "DB_ERROR");
    return data;
}

async function updateEffectiveDate(versionId, effectiveDate) {
    const { error } = await supabase
        .from("clinic_schedule_version")
        .update({ effective_date: effectiveDate })
        .eq("version_id", versionId);

    if (error) throw new AppError(error.message, 500, "DB_ERROR");
}

async function getWorkSlotCountsByVersionIds(versionIds) {
    if (!versionIds || versionIds.length === 0) return {};

    const { data, error } = await supabase
        .from("time_slot_config")
        .select("slot_config_id, version_id")
        .in("version_id", versionIds);

    if (error || !data || data.length === 0) return {};

    const configIds = data.map((r) => r.slot_config_id);
    if (configIds.length === 0) return {};

    const { data: slots, error: slotErr } = await supabase
        .from("work_slot")
        .select("slot_config_id")
        .in("slot_config_id", configIds);

    if (slotErr || !slots || slots.length === 0) return {};

    const configToVersion = {};
    for (const row of data) {
        configToVersion[row.slot_config_id] = row.version_id;
    }

    const counts = {};
    for (const s of slots) {
        const vid = configToVersion[s.slot_config_id];
        if (vid) counts[vid] = (counts[vid] || 0) + 1;
    }
    return counts;
}

async function markAppointmentsConflictBySlotIds(slotIds) {
    if (!slotIds || slotIds.length === 0) return [];

    const { data: appointmentSlots, error: asError } = await supabase
        .from("appointment_slot")
        .select("appt_id, slot_id")
        .in("slot_id", slotIds);

    if (asError) throw new AppError(asError.message, 500, "DB_ERROR");
    if (!appointmentSlots || appointmentSlots.length === 0) return [];

    const apptIds = [...new Set(appointmentSlots.map((as) => as.appt_id).filter(Boolean))];
    if (apptIds.length === 0) return [];

    const note = "Conflict: Clinic working hours changed. Appointment will be rescheduled by staff.";

    const { data, error } = await supabase
        .from("appointment")
        .update({ status: "Conflict", note })
        .in("appt_id", apptIds)
        .eq("status", "Confirmed")
        .select("appt_id, status, note");

    if (error) throw new AppError(error.message, 500, "DB_ERROR");
    return data || [];
}

module.exports = {
    getAllVersionsWithHours,
    findVersionByEffectiveDate,
    createVersion,
    deleteVersionById,
    getWorkingHour,
    getWorkingHourByVersionId,
    insertWorkingHours,
    deleteWorkingHoursByVersionId,
    replaceWorkingHours,
    getTimeSlotConfigsByVersionId,
    replaceTimeSlotConfigs,
    getClosures,
    createClosure,
    deleteClosure,
    countBookedWorkSlots,
    getLastBookedSlotDate,
    findConflictingAppointments,
    getVersionById,
    updateEffectiveDate,
    getWorkSlotCountsByVersionIds,
    markAppointmentsConflictBySlotIds,
};
