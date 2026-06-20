const patientDao = require("./patient.dao");
const AppError = require("../../utils/AppError");

function normalizeProfile(row) {
  if (!row) return null;

  return {
    patientId: row.patient_id,
    accountId: row.account_id,
    fullName: row.full_name || "",
    email: row.email || row.account?.email || "",
    phone: row.phone || row.account?.phone || "",
    birthDate: row.dob || "",
    gender: row.gender || "",
    address: row.address || "",
    medicalHistory: row.medical_history || "",
    avatar: row.avatar || null,
    noShowCount: row.no_show_count ?? 0,
    account: {
      email: row.account?.email || "",
      username: row.account?.username || "",
      status: row.account?.status || "",
      role: row.account?.role?.role_name || "",
    },
  };
}

function normalizeTreatment(row) {
  const schedule = row.work_slot?.schedules;
  const dentist = schedule?.dentist;
  const services = row.appointment_service || [];
  const invoice = Array.isArray(row.invoice) ? row.invoice[0] : row.invoice;
  const treatment = Array.isArray(row.treatment_record)
    ? row.treatment_record[0]
    : row.treatment_record;
  const servicesTotal = services.reduce(
    (sum, service) => sum + Number(service.actual_price || 0),
    0,
  );
  const totalAmount =
    (invoice?.total_amount ?? servicesTotal) || row.total_estimated_amount || null;

  return {
    id: String(treatment?.record_id || row.appt_id),
    appointmentId: row.appt_id,
    date: schedule?.work_date || row.book_time?.slice(0, 10) || "",
    treatment:
      services
        .map((service) => service.dental_service?.service_name)
        .filter(Boolean)
        .join(", ") || "Điều trị nha khoa",
    diagnosis: treatment?.diagnosis || "",
    notes: treatment?.treatment_note || "",
    dentist: dentist
      ? `BS. ${dentist.account?.username || dentist.account?.email || "Nha sĩ"}`
      : "",
    cost: totalAmount,
    status: row.status,
    paymentStatus: invoice?.payment_status || "",
  };
}

async function getMyProfile(patientId) {
  const { data, error } = await patientDao.findProfileByPatientId(patientId);

  if (error) {
    throw new AppError(error.message, 500, "DB_ERROR");
  }

  if (!data) {
    throw new AppError("Patient profile not found.", 404, "PATIENT_NOT_FOUND");
  }

  return normalizeProfile(data);
}

async function updateMyProfile(patientId, payload) {
  const updateFields = {};

  if (payload.fullName !== undefined) updateFields.full_name = payload.fullName;
  if (payload.email !== undefined) updateFields.email = payload.email;
  if (payload.phone !== undefined) updateFields.phone = payload.phone;
  if (payload.birthDate !== undefined) updateFields.dob = payload.birthDate || null;
  if (payload.gender !== undefined) updateFields.gender = payload.gender;
  if (payload.address !== undefined) updateFields.address = payload.address;
  if (payload.medicalHistory !== undefined) {
    updateFields.medical_history = payload.medicalHistory;
  }

  if (!Object.keys(updateFields).length) {
    throw new AppError("No fields to update.", 400, "NO_UPDATES");
  }

  const { data, error } = await patientDao.updateProfile(
    patientId,
    updateFields,
  );

  if (error) {
    throw new AppError(error.message, 500, "DB_ERROR");
  }

  return normalizeProfile(data);
}

async function getMyTreatmentHistory(patientId) {
  const { data, error } =
    await patientDao.findTreatmentHistoryByPatientId(patientId);

  if (error) {
    throw new AppError(error.message, 500, "DB_ERROR");
  }

  return (data || []).map(normalizeTreatment);
}

module.exports = {
  getMyProfile,
  getMyTreatmentHistory,
  updateMyProfile,
};
