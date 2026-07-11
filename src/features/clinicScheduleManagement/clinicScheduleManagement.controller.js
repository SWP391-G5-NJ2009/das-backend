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

module.exports = {
    getWorkingHour,
}