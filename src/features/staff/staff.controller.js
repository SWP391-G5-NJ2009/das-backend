const staffService = require("./staff.service");
const { sendSuccess } = require("../../utils/response");
const {
    validateCreateDentistProfile,
    validateCreateStaffProfile,
    validateUpdateDentistProfile,
    validateUpdateReceptionistProfile,
} = require("./staff.validator");

async function getAllStaff(req, res, next) {
    try {
        const data = await staffService.getAllStaff(req.query);
        return sendSuccess(res, 200, data, "Lấy danh sách nhân sự thành công.");
    } catch (error) {
        return next(error);
    }
}

async function getAvailableDentistAccounts(req, res, next) {
    try {
        const data = await staffService.getAvailableDentistAccounts();
        return sendSuccess(res, 200, data, "Lấy danh sách tài khoản nha sĩ khả dụng thành công.");
    } catch (error) {
        return next(error);
    }
}

async function createDentistProfile(req, res, next) {
    try {
        const payload = validateCreateDentistProfile(req.body);
        const data = await staffService.createDentistProfile(payload);
        return sendSuccess(res, 201, data, "Tạo hồ sơ nha sĩ thành công.");
    } catch (error) {
        return next(error);
    }
}

async function getAvailableStaffAccounts(req, res, next) {
    try {
        const data = await staffService.getAvailableStaffAccounts();
        return sendSuccess(res, 200, data, "Lấy danh sách tài khoản nhân viên thành công.");
    } catch (error) { return next(error); }
}

async function createStaffProfile(req, res, next) {
    try {
        const data = await staffService.createStaffProfile(validateCreateStaffProfile(req.body));
        return sendSuccess(res, 201, data, "Tạo hồ sơ nhân viên thành công.");
    } catch (error) { return next(error); }
}

async function updateDentistProfile(req, res, next) {
    try {
        const payload = validateUpdateDentistProfile(req.body);
        const data = await staffService.updateDentistProfile(req.params.id, payload);
        return sendSuccess(res, 200, data, "Cập nhật hồ sơ nha sĩ thành công.");
    } catch (error) {
        return next(error);
    }
}

async function updateReceptionistProfile(req, res, next) {
    try {
        const payload = validateUpdateReceptionistProfile(req.body);
        const data = await staffService.updateReceptionistProfile(req.params.id, payload);
        return sendSuccess(res, 200, data, "Cập nhật hồ sơ lễ tân thành công.");
    } catch (error) {
        return next(error);
    }
}

module.exports = {
    createDentistProfile,
    getAvailableDentistAccounts,
    getAllStaff,
    getAvailableStaffAccounts,
    createStaffProfile,
    updateDentistProfile,
    updateReceptionistProfile,
};
