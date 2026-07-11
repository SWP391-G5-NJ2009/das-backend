const clinicScheduleManagementService = require("./clinicScheduleManagement.service");
const { sendSuccess } = require("../../utils/response");

async function getWorkingHour(req, res, next) {
    try {
        const data = await clinicScheduleManagementService.getWorkingHour();
        return sendSuccess(res, 200, data, "Working hour data retrieved successfully.");
    } catch (err) {
        return next(err);
    }
}

async function getClinicSetting(req, res, next) {
    try {
        const data = await clinicScheduleManagementService.getClinicSetting();
        return sendSuccess(res, 200, data, "Clinic setting retrieved successfully.");
    } catch (err) {
        return next(err);
    }
}

async function getClosures(req, res, next) {
    try {
        const data = await clinicScheduleManagementService.getClosures();
        return sendSuccess(res, 200, data, "Closures retrieved successfully.");
    } catch (err) {
        return next(err);
    }
}

async function createClosure(req, res, next) {
    try {
        const { closureDate, reason } = req.body;
        const data = await clinicScheduleManagementService.createClosure(closureDate, reason);
        return sendSuccess(res, 201, data, "Closure added successfully.");
    } catch (err) {
        return next(err);
    }
}

async function deleteClosure(req, res, next) {
    try {
        const { id } = req.params;
        const data = await clinicScheduleManagementService.deleteClosure(id);
        return sendSuccess(res, 200, data, "Closure removed successfully.");
    } catch (err) {
        return next(err);
    }
}

async function updateWorkingHours(req, res, next) {
    try {
        const { hours, effectiveDate } = req.body;
        const data = await clinicScheduleManagementService.saveWorkingHours(hours, effectiveDate || null);
        return sendSuccess(res, 200, data, "Working hours updated successfully.");
    } catch (err) {
        return next(err);
    }
}

async function updateClinicSetting(req, res, next) {
    try {
        const { settingId, effectiveDate, ...fields } = req.body;
        const data = await clinicScheduleManagementService.saveClinicSetting(settingId, fields, effectiveDate || null);
        return sendSuccess(res, 200, data, "Clinic setting updated successfully.");
    } catch (err) {
        return next(err);
    }
}

async function cancelPendingWorkingHours(req, res, next) {
    try {
        await clinicScheduleManagementService.cancelPendingWorkingHours();
        return sendSuccess(res, 200, null, "Pending working hours cancelled successfully.");
    } catch (err) {
        return next(err);
    }
}

async function cancelPendingClinicSetting(req, res, next) {
    try {
        await clinicScheduleManagementService.cancelPendingClinicSetting();
        return sendSuccess(res, 200, null, "Pending clinic setting cancelled successfully.");
    } catch (err) {
        return next(err);
    }
}

module.exports = {
    getWorkingHour,
    getClinicSetting,
    getClosures,
    createClosure,
    deleteClosure,
    updateWorkingHours,
    updateClinicSetting,
    cancelPendingWorkingHours,
    cancelPendingClinicSetting,
};
