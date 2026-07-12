const clinicScheduleManagementDao = require("./clinicScheduleManagement.dao");
const AppError = require("../../utils/AppError");

const DEFAULT_SETTINGS = {
    slot_duration_minutes: 30,
    booking_lead_days: 30,
    max_booking_per_slot: 1,
};

function todayStr() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

// ── Version Management ───────────────────────────────────────────

async function createVersion(name, effectiveDate) {
    const pending = await clinicScheduleManagementDao.getPendingVersion();
    if (pending) {
        throw new AppError(
            "A pending version already exists. Please cancel it before creating a new one.",
            409,
            "PENDING_VERSION_EXISTS",
        );
    }

    let dateStr;
    if (effectiveDate) {
        dateStr = typeof effectiveDate === "string"
            ? effectiveDate
            : `${effectiveDate.getFullYear()}-${String(effectiveDate.getMonth() + 1).padStart(2, "0")}-${String(effectiveDate.getDate()).padStart(2, "0")}`;
    } else {
        const min = await getMinEffectiveDate();
        dateStr = min.minEffectiveDate;
    }

    if (dateStr < todayStr()) {
        throw new AppError("Effective date cannot be in the past.", 400, "INVALID_DATE");
    }

    const initialStatus = dateStr <= todayStr() ? "Active" : "Pending";

    const version = await clinicScheduleManagementDao.createVersion(name || null, dateStr, initialStatus);

    const activeVersion = await clinicScheduleManagementDao.getActiveVersion();
    const prevHours = activeVersion
        ? await clinicScheduleManagementDao.getWorkingHourByVersionId(activeVersion.version_id)
        : [];
    const prevSetting = activeVersion
        ? await clinicScheduleManagementDao.getClinicSettingByVersionId(activeVersion.version_id)
        : null;

    const hoursToCopy = prevHours.length > 0
        ? prevHours.map((h) => ({
            day_of_week: h.day_of_week,
            start_time: h.start_time,
            end_time: h.end_time,
        }))
        : [
            { day_of_week: 1, start_time: "08:00", end_time: "12:00" },
            { day_of_week: 1, start_time: "13:00", end_time: "17:00" },
            { day_of_week: 2, start_time: "08:00", end_time: "12:00" },
            { day_of_week: 2, start_time: "13:00", end_time: "17:00" },
            { day_of_week: 3, start_time: "08:00", end_time: "12:00" },
            { day_of_week: 3, start_time: "13:00", end_time: "17:00" },
            { day_of_week: 4, start_time: "08:00", end_time: "12:00" },
            { day_of_week: 4, start_time: "13:00", end_time: "17:00" },
            { day_of_week: 5, start_time: "08:00", end_time: "12:00" },
            { day_of_week: 5, start_time: "13:00", end_time: "17:00" },
            { day_of_week: 6, start_time: "08:00", end_time: "12:00" },
        ];

    const settingToCopy = prevSetting
        ? {
            slot_duration_minutes: prevSetting.slot_duration_minutes,
            booking_lead_days: prevSetting.booking_lead_days,
            max_booking_per_slot: prevSetting.max_booking_per_slot,
        }
        : { ...DEFAULT_SETTINGS };

    await Promise.all([
        clinicScheduleManagementDao.insertWorkingHours(version.version_id, hoursToCopy),
        clinicScheduleManagementDao.insertClinicSetting(version.version_id, settingToCopy),
    ]);

    if (hoursToCopy.length > 0) {
        await generateTimeSlotConfigs(
            version.version_id,
            hoursToCopy,
            settingToCopy.slot_duration_minutes || 30,
        );
    }

    if (initialStatus === "Active") {
        await clinicScheduleManagementDao.expireAllActiveVersions();
        await clinicScheduleManagementDao.activateVersion(version.version_id);
    }

    return { version, initialStatus };
}

async function activatePendingVersion(versionId) {
    const versions = await clinicScheduleManagementDao.getAllVersions();
    const version = versions.find((v) => v.version_id === versionId);
    if (!version) {
        throw new AppError("Version not found.", 404, "NOT_FOUND");
    }
    if (version.status === "Active") {
        throw new AppError("This version is already active.", 400, "ALREADY_ACTIVE");
    }

    const pending = await clinicScheduleManagementDao.getPendingVersion();
    if (pending && pending.version_id !== versionId) {
        throw new AppError(
            "A pending version already exists. Please cancel it before activating another.",
            409,
            "PENDING_VERSION_EXISTS",
        );
    }

    const hours = await clinicScheduleManagementDao.getWorkingHourByVersionId(versionId);
    if (hours && hours.length > 0) {
        const conflicting =
            await clinicScheduleManagementDao.findConflictingAppointments(hours);
        if (conflicting.length > 0) {
            throw new AppError(
                `${conflicting.length} appointment(s) will be affected by this schedule change.`,
                409,
                "CONFLICT_DETECTED",
                { affected: conflicting },
            );
        }
    }

    await clinicScheduleManagementDao.expireAllActiveVersions();
    await clinicScheduleManagementDao.activateVersion(versionId);
    return { success: true };
}

async function getAllVersions() {
    const versions = await clinicScheduleManagementDao.getAllVersions();
    if (!versions || versions.length === 0) return [];

    const ids = versions.map((v) => v.version_id);
    const counts = await clinicScheduleManagementDao.getWorkSlotCountsByVersionIds(ids);

    return versions.map((v) => ({
        ...v,
        hasLinkedWorkSlots: (counts[v.version_id] || 0) > 0,
    }));
}

// ── Working Hours ────────────────────────────────────────────────

async function getWorkingHour() {
    return clinicScheduleManagementDao.getWorkingHour();
}

async function saveWorkingHours(versionId, hours) {
    if (!versionId) {
        throw new AppError("versionId is required.", 400, "MISSING_VERSION");
    }

    if (hours && hours.length > 0) {
        for (const h of hours) {
            if (h.start_time >= h.end_time) {
                throw new AppError(
                    `Invalid time range: start must be before end.`,
                    400,
                    "VALIDATION_ERROR",
                );
            }
        }
    }

    return clinicScheduleManagementDao.replaceWorkingHours(versionId, hours);
}

// ── Clinic Settings ──────────────────────────────────────────────

async function getClinicSetting() {
    return clinicScheduleManagementDao.getClinicSetting();
}

async function saveClinicSetting(versionId, fields) {
    if (!versionId) {
        throw new AppError("versionId is required.", 400, "MISSING_VERSION");
    }

    const existing = await clinicScheduleManagementDao.getClinicSettingByVersionId(versionId);
    if (existing) {
        return clinicScheduleManagementDao.updateClinicSetting(existing.setting_id, fields);
    }
    return clinicScheduleManagementDao.insertClinicSetting(versionId, fields);
}

// ── Time Slot Config Generation ────────────────────────────────

function parseTime(timeStr) {
    const [h, m] = timeStr.split(":").map(Number);
    return h * 60 + m;
}

function formatTime(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

async function generateTimeSlotConfigs(versionId, hours, slotDurationMinutes) {
    const configs = [];

    for (const h of hours) {
        const start = parseTime(h.start_time);
        const end = parseTime(h.end_time);

        for (let t = start; t < end; t += slotDurationMinutes) {
            const slotEnd = t + slotDurationMinutes;
            if (slotEnd > end) break;

            configs.push({
                slot_name: `${formatTime(t)} - ${formatTime(slotEnd)}`,
                start_time: formatTime(t),
                end_time: formatTime(slotEnd),
                version_id: versionId,
                day_of_week: h.day_of_week,
            });
        }
    }

    return clinicScheduleManagementDao.replaceTimeSlotConfigs(versionId, configs);
}

// ── Combined Save ────────────────────────────────────────────────

async function saveAll(versionId, hours, settingFields, force = false) {
    if (!force && hours && hours.length > 0) {
        const conflicting =
            await clinicScheduleManagementDao.findConflictingAppointments(hours);
        if (conflicting.length > 0) {
            throw new AppError(
                `${conflicting.length} appointment(s) will be affected by this schedule change.`,
                409,
                "CONFLICT_DETECTED",
                { affected: conflicting },
            );
        }
    }

    await saveWorkingHours(versionId, hours);
    await saveClinicSetting(versionId, settingFields);

    if (hours && hours.length > 0) {
        const slotDuration = settingFields?.slot_duration_minutes || 30;
        await generateTimeSlotConfigs(versionId, hours, slotDuration);
    }

    if (force && hours && hours.length > 0) {
        const conflicting =
            await clinicScheduleManagementDao.findConflictingAppointments(hours);
        if (conflicting.length > 0) {
            const slotIds = conflicting.map((c) => c.slot_id);
            await clinicScheduleManagementDao.markSlotsAsUnavailable(slotIds);
        }
    }
}

// ── Cancel Pending ───────────────────────────────────────────────

async function cancelPendingVersion() {
    return clinicScheduleManagementDao.deletePendingVersions();
}

async function deleteVersion(versionId) {
    const versions = await clinicScheduleManagementDao.getAllVersions();
    const version = versions.find((v) => v.version_id === versionId);
    if (!version) {
        throw new AppError("Version not found.", 404, "NOT_FOUND");
    }
    if (version.status === "Active") {
        throw new AppError("Cannot delete the active version.", 400, "CANNOT_DELETE_ACTIVE");
    }

    const counts = await clinicScheduleManagementDao.getWorkSlotCountsByVersionIds([versionId]);
    if (counts[versionId] && counts[versionId] > 0) {
        throw new AppError(
            "Cannot delete this version. It has existing appointment records.",
            409,
            "HAS_LINKED_WORK_SLOTS",
        );
    }

    await clinicScheduleManagementDao.deleteVersionById(versionId);
    return { deleted: true };
}

// ── Background Activation ────────────────────────────────────────

async function activateDueVersions() {
    const dueVersions = await clinicScheduleManagementDao.getPendingVersionsDueForActivation();
    let activated = 0;

    for (const version of dueVersions) {
        await activatePendingVersion(version.version_id);
        activated++;
    }

    return activated;
}

// ── Closures ─────────────────────────────────────────────────────

async function getClosures() {
    return clinicScheduleManagementDao.getClosures();
}

async function createClosure(closureDate, reason) {
    return clinicScheduleManagementDao.createClosure(closureDate, reason);
}

async function deleteClosure(closureId) {
    return clinicScheduleManagementDao.deleteClosure(closureId);
}

async function getVersionById(versionId) {
    const version = await clinicScheduleManagementDao.getVersionById(versionId);
    if (!version) throw new AppError("Version not found.", 404, "NOT_FOUND");

    const [hours, setting] = await Promise.all([
        clinicScheduleManagementDao.getWorkingHourByVersionId(versionId),
        clinicScheduleManagementDao.getClinicSettingByVersionId(versionId),
    ]);

    return { version, hours, setting };
}

async function updateEffectiveDate(versionId, effectiveDate) {
    if (!versionId) throw new AppError("versionId is required.", 400, "MISSING_VERSION");
    if (!effectiveDate) throw new AppError("effectiveDate is required.", 400, "MISSING_DATE");

    const dateStr = typeof effectiveDate === "string"
        ? effectiveDate
        : `${effectiveDate.getFullYear()}-${String(effectiveDate.getMonth() + 1).padStart(2, "0")}-${String(effectiveDate.getDate()).padStart(2, "0")}`;

    if (dateStr < todayStr()) {
        throw new AppError("Effective date cannot be in the past.", 400, "INVALID_DATE");
    }

    const version = await clinicScheduleManagementDao.getVersionById(versionId);
    if (!version) throw new AppError("Version not found.", 404, "NOT_FOUND");

    await clinicScheduleManagementDao.updateEffectiveDate(versionId, dateStr);
    return { version_id: versionId, effective_date: dateStr };
}

async function getMinEffectiveDate() {
    const lastBookedDate = await clinicScheduleManagementDao.getLastBookedSlotDate();

    let minDate;
    if (lastBookedDate) {
        const parts = lastBookedDate.split("-").map(Number);
        const d = new Date(parts[0], parts[1] - 1, parts[2] + 1);
        const bookedMin = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        minDate = bookedMin > todayStr() ? bookedMin : todayStr();
    } else {
        minDate = todayStr();
    }

    return { minEffectiveDate: minDate, lastBookedDate };
}

module.exports = {
    createVersion,
    activatePendingVersion,
    getAllVersions,
    getWorkingHour,
    saveWorkingHours,
    getClinicSetting,
    saveClinicSetting,
    saveAll,
    cancelPendingVersion,
    deleteVersion,
    activateDueVersions,
    getClosures,
    createClosure,
    deleteClosure,
    getVersionById,
    updateEffectiveDate,
    getMinEffectiveDate,
};
