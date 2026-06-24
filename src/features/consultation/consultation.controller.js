const consultationService = require("./consultation.service");
const { sendSuccess } = require("../../utils/response");
const {
  validateCreateConsultation,
  validateUpdateConsultation,
} = require("./consultation.validator");

async function getAllConsultationRequests(req, res, next) {
  try {
    const filters = {
      status: req.query.status || null,
      date: req.query.date || null,
      search: req.query.search || null,
    };
    const data = await consultationService.getAllConsultationRequests(filters);
    return sendSuccess(res, 200, data, "Requests retrieved successfully.");
  } catch (err) {
    return next(err);
  }
}

async function createConsultationRequest(req, res, next) {
  try {
    const payload = validateCreateConsultation(req.body);

    if (Date.now() - payload.loadedAt < 3000) {
      throw new AppError("Form submitted too quickly.", 400, "SPAM_DETECTED");
    }

    const data = await consultationService.createConsultationRequest(payload);
    return sendSuccess(res, 201, data, "Consultation created successfully.");
  } catch (err) {
    return next(err);
  }
}

async function updateConsultationRequest(req, res, next) {
  try {
    const { id } = req.params;
    const payload = validateUpdateConsultation(req.body);
    const data = await consultationService.updateConsultationRequest(id, payload);
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
