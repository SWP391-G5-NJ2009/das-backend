const clinicScheduleManagementDao = require("./clinicScheduleManagement.dao");
const AppError = require("../../utils/AppError");
const { todayVietnam } = require("../../utils/dateUtils");

const SLOT_DURATION_MINUTES = 30;

function todayStr() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

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
        throw new AppError("Ngày hiệu lực không được ở quá khứ.", 400, "INVALID_DATE");
    }

    const initialStatus = dateStr <= todayStr() ? "Active" : "Pending";

    const version = await clinicScheduleManagementDao.createVersion(name || null, dateStr, initialStatus);

    const activeVersion = await clinicScheduleManagementDao.getActiveVersion();
    const prevHours = activeVersion
        ? await clinicScheduleManagementDao.getWorkingHourByVersionId(activeVersion.version_id)
        : [];

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

    await clinicScheduleManagementDao.insertWorkingHours(version.version_id, hoursToCopy);

    if (hoursToCopy.length > 0) {
        await generateTimeSlotConfigs(version.version_id, hoursToCopy, SLOT_DURATION_MINUTES);
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
        throw new AppError("Không tìm thấy phiên bản.", 404, "NOT_FOUND");
    }
    if (version.status === "Active") {
        throw new AppError("Phiên bản này đang hoạt động.", 400, "ALREADY_ACTIVE");
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

async function getWorkingHour() {
    return clinicScheduleManagementDao.getWorkingHour();
}

async function saveWorkingHours(versionId, hours) {
    if (!versionId) {
        throw new AppError("Thiếu versionId.", 400, "MISSING_VERSION");
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

async function saveAll(versionId, hours, { force = false } = {}) {
    let conflicts = [];

    const version = await clinicScheduleManagementDao.getVersionById(versionId);

    const today = todayVietnam();
    if (version && version.effective_date <= today) {
        const counts = await clinicScheduleManagementDao.getWorkSlotCountsByVersionIds([versionId]);
        const hasWorkSlots = (counts[versionId] || 0) > 0;

        if (hasWorkSlots) {
            if (hours && hours.length > 0) {
                conflicts = await clinicScheduleManagementDao.findConflictingAppointments(hours);
            }
            return {
                success: false,
                conflicts,
                message: `${conflicts.length} appointment(s) will be affected by this schedule change.`,
            };
        }
    }

    if (hours && hours.length > 0) {
        conflicts = await clinicScheduleManagementDao.findConflictingAppointments(hours);

        if (!force && conflicts.length > 0) {
            return {
                success: false,
                conflicts,
                message: `${conflicts.length} appointment(s) will be affected by this schedule change.`,
            };
        }

        if (force && conflicts.length > 0) {
            await markAppointmentsConflict(conflicts);
        }
    }

    await saveWorkingHours(versionId, hours);

    if (hours && hours.length > 0) {
        await generateTimeSlotConfigs(versionId, hours, SLOT_DURATION_MINUTES);
    }

    return { success: true, conflicts: [] };
}

async function deleteVersion(versionId) {
    const versions = await clinicScheduleManagementDao.getAllVersions();
    const version = versions.find((v) => v.version_id === versionId);
    if (!version) {
        throw new AppError("Không tìm thấy phiên bản.", 404, "NOT_FOUND");
    }
    if (version.status === "Active") {
        throw new AppError("Không thể xóa phiên bản đang hoạt động.", 400, "CANNOT_DELETE_ACTIVE");
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

async function activateDueVersions() {
    const dueVersions = await clinicScheduleManagementDao.getPendingVersionsDueForActivation();
    let activated = 0;

    for (const version of dueVersions) {
        await activatePendingVersion(version.version_id);
        activated++;
    }

    return activated;
}

async function getVersionById(versionId) {
    const version = await clinicScheduleManagementDao.getVersionById(versionId);
    if (!version) throw new AppError("Không tìm thấy phiên bản.", 404, "NOT_FOUND");

    const hours = await clinicScheduleManagementDao.getWorkingHourByVersionId(versionId);

    return { version, hours };
}

async function updateEffectiveDate(versionId, effectiveDate) {
    if (!versionId) throw new AppError("Thiếu versionId.", 400, "MISSING_VERSION");
    if (!effectiveDate) throw new AppError("Thiếu effectiveDate.", 400, "MISSING_DATE");

    const dateStr = typeof effectiveDate === "string"
        ? effectiveDate
        : `${effectiveDate.getFullYear()}-${String(effectiveDate.getMonth() + 1).padStart(2, "0")}-${String(effectiveDate.getDate()).padStart(2, "0")}`;

    if (dateStr < todayStr()) {
        throw new AppError("Ngày hiệu lực không được ở quá khứ.", 400, "INVALID_DATE");
    }

    const version = await clinicScheduleManagementDao.getVersionById(versionId);
    if (!version) throw new AppError("Không tìm thấy phiên bản.", 404, "NOT_FOUND");

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
        minDate = bookedMin > todayVietnam() ? bookedMin : todayVietnam();
    } else {
        minDate = todayVietnam();
    }

    return { minEffectiveDate: minDate, lastBookedDate };
}

async function markAppointmentsConflict(conflicts) {
    if (!conflicts || conflicts.length === 0) return;

    const slotIds = conflicts.map((c) => c.slot_id).filter(Boolean);
    if (slotIds.length === 0) return;

    const result = await clinicScheduleManagementDao.markAppointmentsConflictBySlotIds(slotIds);
    return result;
}

async function createVersionWithHours(name, effectiveDate, hours) {
    let dateStr;
    if (effectiveDate) {
        dateStr = typeof effectiveDate === "string"
            ? effectiveDate
            : `${effectiveDate.getFullYear()}-${String(effectiveDate.getMonth() + 1).padStart(2, "0")}-${String(effectiveDate.getDate()).padStart(2, "0")}`;
    } else {
        const min = await getMinEffectiveDate();
        dateStr = min.minEffectiveDate;
    }

    if (dateStr < todayVietnam()) {
        throw new AppError("Effective date cannot be in the past.", 400, "INVALID_DATE");
    }

    const duplicate = await clinicScheduleManagementDao.findVersionByEffectiveDate(dateStr);
    if (duplicate) {
        throw new AppError(
            `A version (ID: ${duplicate.version_id}) already has the effective date ${dateStr}.`,
            409,
            "DUPLICATE_DATE",
        );
    }

    const version = await clinicScheduleManagementDao.createVersion(name || null, dateStr);

    if (hours && hours.length > 0) {
        await clinicScheduleManagementDao.insertWorkingHours(version.version_id, hours);
        await generateTimeSlotConfigs(version.version_id, hours, SLOT_DURATION_MINUTES);
    }

    return { version };
}

module.exports = {
    getWorkingHour,
    saveWorkingHours,
    saveAll,
    deleteVersion,
    getVersionById,
    updateEffectiveDate,
    getMinEffectiveDate,
    markAppointmentsConflict,
    createVersionWithHours,
};
