const consultationDao = require("./consultation.dao");
const AppError = require("../../utils/AppError");

async function getAllConsultationRequests() {
  const { data, error } = await consultationDao.findAllConsultationRequests();

  if (error) {
    throw new AppError(error.message, 500, "DB_ERROR");
  }

  return data || [];
}

async function createConsultationRequest({
  full_name,
  phone,
  email,
  description,
}) {
  const { data, error } = await consultationDao.insertConsultationRequest({
    full_name,
    phone,
    email,
    description,
  });

  if (error) {
    throw new AppError(error.message, 500, "DB_ERROR");
  }

  return data;
}

async function updateConsultationRequest(id, { status, note }) {
  const updateFields = {};

  if (status !== undefined) {
    updateFields.status = status;
  }

  if (note !== undefined) {
    updateFields.note = note;
  }

  const { data, error } = await consultationDao.updateConsultationRequest(
    id,
    updateFields,
  );

  if (error) {
    throw new AppError(error.message, 500, "DB_ERROR");
  }

  return data;
}

module.exports = {
  createConsultationRequest,
  getAllConsultationRequests,
  updateConsultationRequest,
};
