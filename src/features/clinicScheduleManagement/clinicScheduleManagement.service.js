const clinicScheduleManagementDao = require("./clinicScheduleManagement.dao");
const AppError = require("../../utils/AppError");

const DEFAULT_SETTINGS = {
    slot_duration_minutes: 30,
    booking_lead_days: 30,
    max_booking_per_slot: 1,
    appointment_buffer_minutes: 0,
};

function todayStr() {
    return new Date().toISOString().slice(0, 10);
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

    const allVersions = await clinicScheduleManagementDao.getAllVersions();
    const isFirstVersion = allVersions.length === 0;

    let dateStr;
    if (effectiveDate) {
        dateStr = typeof effectiveDate === "string"
            ? effectiveDate
            : new Date(effectiveDate).toISOString().slice(0, 10);
    } else {
        const d = new Date();
        if (!isFirstVersion) {
            d.setUTCDate(d.getUTCDate() + 1);
        }
        dateStr = d.toISOString().slice(0, 10);
    }

    if (dateStr < todayStr()) {
        throw new AppError("Effective date cannot be in the past.", 400, "INVALID_DATE");
    }

    const initialStatus = dateStr <= todayStr() ? "Active" : "Pending";

    const [whVersion, csVersion] = await Promise.all([
        clinicScheduleManagementDao.createVersion(name || null, dateStr, initialStatus),
        clinicScheduleManagementDao.createSettingVersion(name || null, dateStr, initialStatus),
    ]);

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
            appointment_buffer_minutes: prevSetting.appointment_buffer_minutes,
        }
        : { ...DEFAULT_SETTINGS };

    await Promise.all([
        clinicScheduleManagementDao.insertWorkingHours(whVersion.version_id, hoursToCopy),
        clinicScheduleManagementDao.insertClinicSetting(csVersion.version_id, settingToCopy),
    ]);

    if (initialStatus === "Active") {
        await clinicScheduleManagementDao.expireAllActiveVersions();
        await Promise.all([
            clinicScheduleManagementDao.activateVersion(whVersion.version_id),
            clinicScheduleManagementDao.activateSettingVersion(csVersion.version_id),
        ]);
    }

    return { whVersion, csVersion, initialStatus };
}

async function activatePendingVersion(versionId) {
    await clinicScheduleManagementDao.expireAllActiveVersions();
    await Promise.all([
        clinicScheduleManagementDao.activateVersion(versionId),
        clinicScheduleManagementDao.activateSettingVersion(versionId),
    ]);
    return { success: true };
}

async function getAllVersions() {
    return clinicScheduleManagementDao.getAllVersions();
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
    await clinicScheduleManagementDao.deleteVersionById(versionId);
    await clinicScheduleManagementDao.deleteSettingVersionById(versionId);
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
        : new Date(effectiveDate).toISOString().slice(0, 10);

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
        const d = new Date(lastBookedDate + "T00:00:00Z");
        d.setUTCDate(d.getUTCDate() + 1);
        minDate = d.toISOString().slice(0, 10);
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
