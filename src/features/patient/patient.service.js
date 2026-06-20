const patientDao = require("./patient.dao");
const AppError = require("../../utils/AppError");

/**
 * Search patients by name or phone.
 * @param {string} q - Search term (min 2 chars enforced at controller level)
 */
async function searchPatients(q) {
  const data = await patientDao.searchPatients(q);

  return data.map((p) => ({
    id: String(p.patient_id),
    fullName: p.full_name,
    phone: p.phone || "",
    email: p.email || "",
    dob: p.dob || null,
    gender: p.gender || null,
  }));
}

module.exports = { searchPatients };
