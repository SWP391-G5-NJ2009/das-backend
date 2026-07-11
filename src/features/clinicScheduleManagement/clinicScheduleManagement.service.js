const clinicScheduleManagementDao = require("./clinicScheduleManagement.dao");
const AppError = require("../../utils/AppError");

async function getWorkingHour() {
    return clinicScheduleManagementDao.getWorkingHour();
}

async function getClinicSetting() {
    return clinicScheduleManagementDao.getClinicSetting();
}

async function getClosures() {
    return clinicScheduleManagementDao.getClosures();
}

async function createClosure(closureDate, reason) {
    return clinicScheduleManagementDao.createClosure(closureDate, reason);
}

async function deleteClosure(closureId) {
    return clinicScheduleManagementDao.deleteClosure(closureId);
}

async function saveWorkingHours(hours, effectiveDate) {
    const bookedCount = await clinicScheduleManagementDao.countBookedWorkSlots();

    if (bookedCount > 0 && !effectiveDate) {
        const lastBookedDate = await clinicScheduleManagementDao.getLastBookedSlotDate();
        throw new AppError(
            `Cannot update schedule: there are currently ${bookedCount} booked appointment(s) in the system. Please complete or cancel them before modifying operational hours.`,
            409,
            "SLOTS_HAVE_BOOKINGS",
            { lastBookedDate },
        );
    }

    if (effectiveDate) {
        return clinicScheduleManagementDao.insertWorkingHourOverrides(
            hours.map((h) => ({ ...h, effective_date: effectiveDate })),
        );
    }

    await clinicScheduleManagementDao.deleteAllWorkingHours();
    return clinicScheduleManagementDao.insertWorkingHours(hours);
}

async function saveClinicSetting(settingId, fields, effectiveDate) {
    const bookedCount = await clinicScheduleManagementDao.countBookedWorkSlots();

    if (bookedCount > 0 && !effectiveDate) {
        const lastBookedDate = await clinicScheduleManagementDao.getLastBookedSlotDate();
        throw new AppError(
            `Cannot update time management: there are currently ${bookedCount} booked appointment(s). Please complete or cancel them first.`,
            409,
            "SLOTS_HAVE_BOOKINGS",
            { lastBookedDate },
        );
    }

    if (effectiveDate) {
        return clinicScheduleManagementDao.upsertClinicSettingOverride(fields, effectiveDate);
    }

    if (!settingId) {
        return clinicScheduleManagementDao.insertClinicSetting(fields);
    }

    return clinicScheduleManagementDao.updateClinicSetting(settingId, fields);
}

async function cancelPendingWorkingHours() {
    return clinicScheduleManagementDao.deletePendingWorkingHours();
}

async function cancelPendingClinicSetting() {
    return clinicScheduleManagementDao.deletePendingClinicSetting();
}

module.exports = {
    getWorkingHour,
    getClinicSetting,
    getClosures,
    createClosure,
    deleteClosure,
    saveWorkingHours,
    saveClinicSetting,
    cancelPendingWorkingHours,
    cancelPendingClinicSetting,
};
