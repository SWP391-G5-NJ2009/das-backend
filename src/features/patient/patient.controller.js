const patientService = require("./patient.service");
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

module.exports = { searchPatients };
