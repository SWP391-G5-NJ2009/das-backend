const clinicScheduleManagementService = require("./clinicScheduleManagement.service");
const { sendSuccess } = require("../../utils/response");

async function createVersion(req, res, next) {
    try {
        const { name, effectiveDate } = req.body;
        const data = await clinicScheduleManagementService.createVersion(name, effectiveDate);
        return sendSuccess(res, 201, data, "Version created successfully.");
    } catch (err) {
        return next(err);
    }
}

async function getVersions(req, res, next) {
    try {
        const data = await clinicScheduleManagementService.getAllVersions();
        return sendSuccess(res, 200, data, "Versions retrieved successfully.");
    } catch (err) {
        return next(err);
    }
}

async function getWorkingHour(req, res, next) {
    try {
        const data = await clinicScheduleManagementService.getWorkingHour();
        return sendSuccess(res, 200, data, "Working hour data retrieved successfully.");
    } catch (err) {
        return next(err);
    }
}

async function updateWorkingHours(req, res, next) {
    try {
        const { versionId, hours } = req.body;
        const data = await clinicScheduleManagementService.saveWorkingHours(versionId, hours);
        return sendSuccess(res, 200, data, "Working hours updated successfully.");
    } catch (err) {
        return next(err);
    }
}

async function saveAll(req, res, next) {
    try {
        const { versionId, hours, force } = req.body;
        await clinicScheduleManagementService.saveAll(versionId, hours, force);
        return sendSuccess(res, 200, null, "Schedule updated successfully.");
    } catch (err) {
        return next(err);
    }
}

async function cancelPending(req, res, next) {
    try {
        await clinicScheduleManagementService.cancelPendingVersion();
        return sendSuccess(res, 200, null, "Pending changes cancelled successfully.");
    } catch (err) {
        return next(err);
    }
}

async function deleteVersion(req, res, next) {
    try {
        const { id } = req.params;
        const data = await clinicScheduleManagementService.deleteVersion(Number(id));
        return sendSuccess(res, 200, data, "Version deleted successfully.");
    } catch (err) {
        return next(err);
    }
}

async function activateVersion(req, res, next) {
    try {
        const { id } = req.params;
        const data = await clinicScheduleManagementService.activatePendingVersion(Number(id));
        return sendSuccess(res, 200, data, "Version activated successfully.");
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

async function getVersionById(req, res, next) {
    try {
        const { id } = req.params;
        const data = await clinicScheduleManagementService.getVersionById(Number(id));
        return sendSuccess(res, 200, data, "Version data retrieved successfully.");
    } catch (err) {
        return next(err);
    }
}

async function updateEffectiveDate(req, res, next) {
    try {
        const { id } = req.params;
        const { effectiveDate } = req.body;
        const data = await clinicScheduleManagementService.updateEffectiveDate(Number(id), effectiveDate);
        return sendSuccess(res, 200, data, "Effective date updated successfully.");
    } catch (err) {
        return next(err);
    }
}

async function getMinEffectiveDate(req, res, next) {
    try {
        const data = await clinicScheduleManagementService.getMinEffectiveDate();
        return sendSuccess(res, 200, data, "Minimum effective date retrieved successfully.");
    } catch (err) {
        return next(err);
    }
}

module.exports = {
    createVersion,
    getVersions,
    getWorkingHour,
    updateWorkingHours,
    saveAll,
    cancelPending,
    deleteVersion,
    activateVersion,
    getClosures,
    createClosure,
    deleteClosure,
    getVersionById,
    updateEffectiveDate,
    getMinEffectiveDate,
};
