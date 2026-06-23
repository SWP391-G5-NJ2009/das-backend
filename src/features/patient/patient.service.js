const patientDao = require("./patient.dao");
const accountService = require("../account/account.service");
const textbeeService = require("../../integrations/textbee/textbee.service");
const AppError = require("../../utils/AppError");
const logger = require("../../utils/logger");

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
    birthDate: p.birth_date || null,
    gender: p.gender || null,
  }));
}

function normalizeProfile(row) {
  if (!row) {
    return null;
  }

  return {
    patientId: row.patient_id,
    accountId: row.account_id,
    fullName: row.full_name || "",
    phone: row.phone || row.account?.phone || "",
    birthDate: row.birth_date || "",
    gender: row.gender || "",
    address: row.address || "",
  };
}

function normalizeTreatment(row) {
  const schedule = row.work_slot?.schedules;
  const services = row.appointment_service || [];
  const invoice = Array.isArray(row.invoice) ? row.invoice[0] : row.invoice;
  const treatment = Array.isArray(row.treatment_record)
    ? row.treatment_record[0]
    : row.treatment_record;

  return {
    id: String(row.appt_id),
    date: schedule?.work_date || "",
    treatment:
      services
        .map((service) => service.dental_service?.service_name)
        .filter(Boolean)
        .join(", ") || "Điều trị nha khoa",
    diagnosis: treatment?.diagnosis || "",
    dentist: schedule?.dentist?.full_name || "",
    cost: invoice?.total_amount ?? null,
  };
}

async function sendPatientPasswordSms({ accountId, phone, password }) {
  try {
    await textbeeService.sendSms({
      recipient: phone,
      message: textbeeService.patientAccountPassword({ phone, password }),
    });
    return "textbee";
  } catch (smsError) {
    logger.error("TextBee patient account delivery failed.", {
      accountId,
      error: smsError.message,
      code: smsError.code,
    });
    return "textbee_failed";
  }
}

async function createPatientAccount({
  fullName,
  phone,
  birthDate,
  gender,
  address,
  password,
}) {
  const { data: existing, error: existingError } =
    await patientDao.findProfileByPhone(phone);

  if (existingError) {
    throw new AppError(existingError.message, 500, "DB_ERROR");
  }

  if (existing?.account_id) {
    throw new AppError("Phone number already exists.", 409, "DUPLICATE_PHONE");
  }

  const account = await accountService.createAccount({
    username: phone,
    email: null,
    phone,
    password,
    role_name: "Patient",
    status: "Active",
  });

  const patientPayload = {
    account_id: account.account_id,
    full_name: fullName,
    phone,
    birth_date: birthDate || null,
    gender: gender || null,
    address: address || null,
    no_show_count: 0,
  };
  const saveProfile = existing
    ? patientDao.linkProfileAccount(existing.patient_id, patientPayload)
    : patientDao.insertProfile(patientPayload);
  const { data, error } = await saveProfile;

  if (error) {
    await accountService.deleteAccount(account.account_id).catch(() => {});
    throw new AppError(error.message, 500, "DB_ERROR");
  }

  return {
    ...normalizeProfile(data),
    passwordSmsDelivery: await sendPatientPasswordSms({
      accountId: account.account_id,
      phone,
      password,
    }),
  };
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
  searchPatients,
  createPatientAccount,
  getMyTreatmentHistory,
};
