const consultationService = require("../services/consultation.service")
const { sendSuccess } = require("../utils/response")

async function createConsultationRequest(req, res, next) {
    try {
        const data = await consultationService.createConsultationRequest(req.body);
        return sendSuccess(res, 201, data, "Account created successfully.");
    } catch (err) {
        return next(err);
    }
}

module.exports = {
    createConsultationRequest,
};