const consultationDao = require("./consultation.dao");
const logger = require("../../utils/logger");
const AppError = require("../../utils/AppError");

async function getAllConsultationRequests(filters = {}) {
  const { data, error, count } = await consultationDao.findAllConsultationRequests(filters);

  if (error) {
    logger.error("Failed to retrieve consultation request", error);
    throw new AppError("Đã xảy ra lỗi. Vui lòng thử lại sau.", 500, "DB_ERROR");
  }

  return { items: data || [], total: count || 0 };
}

async function createConsultationRequest({
  full_name,
  phone,
  email,
  description,
  service_id,
  consultation_date,
}) {
  const { data, error } = await consultationDao.insertConsultationRequest({
    full_name,
    phone,
    email: service || null,
    description: description || null,
    service_id: service_id || null,
    consultation_date: consultation_date || null,
  });

  if (error) {
    logger.error("Failed to insert consultation request", error);
    throw new AppError("Đã xảy ra lỗi. Vui lòng thử lại sau.", 500, "DB_ERROR");
  }

  return data;
}

async function updateConsultationRequest(id, { status, note }) {
  const { data, error } = await consultationDao.updateConsultationRequest(
    id,
    {
      ...(status !== undefined ? { status } : {}),
      ...(note !== undefined ? { note } : {}),
    },
  );

  if (error) {
    logger.error("Failed to update consultation request", error);
    throw new AppError("Đã xảy ra lỗi. Vui lòng thử lại sau.", 500, "DB_ERROR");
  }

  return data;
}

module.exports = {
  createConsultationRequest,
  getAllConsultationRequests,
  updateConsultationRequest,
};
