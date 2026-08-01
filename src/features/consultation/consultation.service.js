const consultationDao = require("./consultation.dao");
const AppError = require("../../utils/AppError");

async function getAllConsultationRequests(filters = {}) {
  const { data, error, count } = await consultationDao.findAllConsultationRequests(filters);

  if (error) {
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
    email: email || null,
    description,
    service_id: service_id || null,
    consultation_date: consultation_date || null,
  });

  if (error) {
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
    throw new AppError("Đã xảy ra lỗi. Vui lòng thử lại sau.", 500, "DB_ERROR");
  }

  return data;
}

module.exports = {
  createConsultationRequest,
  getAllConsultationRequests,
  updateConsultationRequest,
};
