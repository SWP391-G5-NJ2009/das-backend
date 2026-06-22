const patientService = require("./patient.service");
const {
  validateCreatePatientAccount,
  validateUpdateMyProfile,
} = require("./patient.validator");
const { sendSuccess } = require("../../utils/response");

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
  createPatientAccount,
  getMyProfile,
  getMyTreatmentHistory,
  updateMyProfile,
};
