const staffService = require("./staff.service");
const { sendSuccess } = require("../../utils/response");

async function getAllStaff(req, res, next) {
    try {
        const data = await staffService.getAllStaff(req.query);
        return sendSuccess(res, 200, data, "Staff retrieved successfully.");
    } catch (error) {
        return next(error);
    }
}

module.exports = {
    getAllStaff,
};