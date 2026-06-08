const consultationService = require("../services/consultation.service")
const { sendSuccess } = require("../utils/response")

async function getAllConsultationRequests(req, res, next) {
    try {
        const data = await consultationService.getAllConsultationRequests();
        return sendSuccess(res, 200, data, "Requests retrieved successfully.");
    } catch (err) {
        return next(err);
    }
}

async function createConsultationRequest(req, res, next) {
    try {
        const data = await consultationService.createConsultationRequest(req.body);
        return sendSuccess(res, 201, data, "Account created successfully.");
    } catch (err) {
        return next(err);
    }
}

async function updateConsultationRequest(req, res, next) {
    try {
        const { id } = req.params;
        const {status, note} = req.body;
        const data = await consultationService.updateConsultationRequest(id, {status, note});
        return sendSuccess(res, 200, data, "Request updated successfully.");
    } catch (err) {
        return next(err);
    }
}

module.exports = {
    getAllConsultationRequests,
    createConsultationRequest,
    updateConsultationRequest,
};