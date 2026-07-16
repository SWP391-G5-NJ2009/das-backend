const clinicScheduleManagementService = require("./clinicScheduleManagement.service");
const { sendSuccess } = require("../../utils/response");

async function createVersion(req, res, next) {
    try {
        const { name, effectiveDate } = req.body;
        const data = await clinicScheduleManagementService.createVersion(name, effectiveDate);
        return sendSuccess(res, 201, data, "Tạo phiên bản thành công.");
    } catch (err) {
        return next(err);
    }
}

async function getVersions(req, res, next) {
    try {
        const data = await clinicScheduleManagementService.getAllVersions();
        return sendSuccess(res, 200, data, "Lấy danh sách phiên bản thành công.");
    } catch (err) {
        return next(err);
    }
}

async function getWorkingHour(req, res, next) {
    try {
        const data = await clinicScheduleManagementService.getWorkingHour();
        return sendSuccess(res, 200, data, "Lấy dữ liệu giờ làm việc thành công.");
    } catch (err) {
        return next(err);
    }
}

async function updateWorkingHours(req, res, next) {
    try {
        const { versionId, hours } = req.body;
        const data = await clinicScheduleManagementService.saveWorkingHours(versionId, hours);
        return sendSuccess(res, 200, data, "Cập nhật giờ làm việc thành công.");
    } catch (err) {
        return next(err);
    }
}

async function saveAll(req, res, next) {
    try {
        const { versionId, hours, force } = req.body;
        await clinicScheduleManagementService.saveAll(versionId, hours, force);
        return sendSuccess(res, 200, null, "Cập nhật lịch thành công.");
    } catch (err) {
        return next(err);
    }
}

async function cancelPending(req, res, next) {
    try {
        await clinicScheduleManagementService.cancelPendingVersion();
        return sendSuccess(res, 200, null, "Đã hủy các thay đổi đang chờ.");
    } catch (err) {
        return next(err);
    }
}

async function deleteVersion(req, res, next) {
    try {
        const { id } = req.params;
        const data = await clinicScheduleManagementService.deleteVersion(Number(id));
        return sendSuccess(res, 200, data, "Xóa phiên bản thành công.");
    } catch (err) {
        return next(err);
    }
}

async function activateVersion(req, res, next) {
    try {
        const { id } = req.params;
        const data = await clinicScheduleManagementService.activatePendingVersion(Number(id));
        return sendSuccess(res, 200, data, "Kích hoạt phiên bản thành công.");
    } catch (err) {
        return next(err);
    }
}

async function getVersionById(req, res, next) {
    try {
        const { id } = req.params;
        const data = await clinicScheduleManagementService.getVersionById(Number(id));
        return sendSuccess(res, 200, data, "Lấy dữ liệu phiên bản thành công.");
    } catch (err) {
        return next(err);
    }
}

async function updateEffectiveDate(req, res, next) {
    try {
        const { id } = req.params;
        const { effectiveDate } = req.body;
        const data = await clinicScheduleManagementService.updateEffectiveDate(Number(id), effectiveDate);
        return sendSuccess(res, 200, data, "Cập nhật ngày hiệu lực thành công.");
    } catch (err) {
        return next(err);
    }
}

async function getMinEffectiveDate(req, res, next) {
    try {
        const data = await clinicScheduleManagementService.getMinEffectiveDate();
        return sendSuccess(res, 200, data, "Lấy ngày hiệu lực tối thiểu thành công.");
    } catch (err) {
        return next(err);
    }
}

async function createVersionWithHours(req, res, next) {
    try {
        const { name, effectiveDate, hours } = req.body;
        const data = await clinicScheduleManagementService.createVersionWithHours(name, effectiveDate, hours);
        return sendSuccess(res, 201, data, "Tạo phiên bản với giờ làm việc thành công.");
    } catch (err) {
        return next(err);
    }
}

module.exports = {
    getWorkingHour,
    updateWorkingHours,
    saveAll,
    deleteVersion,
    getVersionById,
    updateEffectiveDate,
    getMinEffectiveDate,
    createVersionWithHours,
};
