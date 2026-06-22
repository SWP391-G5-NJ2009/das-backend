const patientService = require("./patient.service");
const {
  validateCreatePatientAccount,
  validateUpdateMyProfile,
} = require("./patient.validator");
const { sendSuccess } = require("../../utils/response");
const AppError = require("../../utils/AppError");
/**
 * GET /api/patients/search?q=...
 * Receptionist: search patients by name or phone.
 */
async function searchPatients(req, res, next) {
  try {
    const q = (req.query.q || "").trim();
    if (q.length < 2) {
      return sendSuccess(res, 200, [], "Query too short.");
    }
    const data = await patientService.searchPatients(q);
    return sendSuccess(res, 200, data, "Patients fetched successfully.");
  } catch (err) {
    return next(err);
  }
}

async function createPatientAccount(req, res, next) {
  try {
    const payload = validateCreatePatientAccount(req.body);
    const data = await patientService.createPatientAccount(payload);
    return sendSuccess(res, 201, data, "Patient account created successfully.");
  } catch (err) {
    return next(err);
  }
}

async function getMyProfile(req, res, next) {
  try {
    const data = await patientService.getMyProfile(req.user.profileId);
    return sendSuccess(res, 200, data, "Patient profile fetched successfully.");
  } catch (err) {
    return next(err);
  }
}

async function updateMyProfile(req, res, next) {
  try {
    const payload = validateUpdateMyProfile(req.body);
    const data = await patientService.updateMyProfile(
      req.user.profileId,
      payload,
    );
    return sendSuccess(res, 200, data, "Patient profile updated successfully.");
  } catch (err) {
    return next(err);
  }
}

async function getMyTreatmentHistory(req, res, next) {
  try {
    const data = await patientService.getMyTreatmentHistory(req.user.profileId);
    return sendSuccess(
      res,
      200,
      data,
      "Treatment history fetched successfully.",
    );
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  searchPatients,
  createPatientAccount,
  getMyProfile,
  getMyTreatmentHistory,
  updateMyProfile,
};
