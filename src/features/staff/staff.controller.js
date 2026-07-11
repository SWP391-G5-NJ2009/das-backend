const staffService = require("./staff.service");
const { sendSuccess } = require("../../utils/response");
const { validateCreateDentistProfile } = require("./staff.validator");

async function getAllStaff(req, res, next) {
    try {
        const data = await staffService.getAllStaff(req.query);
        return sendSuccess(res, 200, data, "Staff retrieved successfully.");
    } catch (error) {
        return next(error);
    }
}

async function getAvailableDentistAccounts(req, res, next) {
    try {
        const data = await staffService.getAvailableDentistAccounts();
        return sendSuccess(res, 200, data, "Available Dentist accounts retrieved successfully.");
    } catch (error) {
        return next(error);
    }
}

async function createDentistProfile(req, res, next) {
    try {
        const payload = validateCreateDentistProfile(req.body);
        const data = await staffService.createDentistProfile(payload);
        return sendSuccess(res, 201, data, "Dentist profile created successfully.");
    } catch (error) {
        return next(error);
    }
}

module.exports = {
    createDentistProfile,
    getAvailableDentistAccounts,
    getAllStaff,
};
