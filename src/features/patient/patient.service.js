const patientDao = require("./patient.dao");
const accountService = require("../account/account.service");
const textbeeService = require("../../integrations/textbee/textbee.service");
const AppError = require("../../utils/AppError");
const logger = require("../../utils/logger");
const normalizeRole = require("../../utils/normalizeRole");

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
    email: row.email || row.account?.email || "",
    phone: row.phone || row.account?.phone || "",
    birthDate: row.birth_date || "",
    gender: row.gender || "",
    address: row.address || "",
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
    (invoice?.total_amount ?? servicesTotal) ||
    row.total_estimated_amount ||
    null;

  return {
    recordId: treatment?.record_id || null,
    id: String(treatment?.record_id || row.appt_id),
    appointmentId: row.appt_id,
    date: schedule?.work_date || row.book_time?.slice(0, 10) || "",
    startTime:
      row.work_slot?.slot_config?.start_time?.substring(0, 5) || "",
    endTime: row.work_slot?.slot_config?.end_time?.substring(0, 5) || "",
    treatment:
      services
        .map((service) => service.dental_service?.service_name)
        .filter(Boolean)
        .join(", ") || "Điều trị nha khoa",
    diagnosis: treatment?.diagnosis || "",
    treatmentNote: treatment?.treatment_note || "",
    notes: treatment?.treatment_note || "",
    appointmentNote: row.note || "",
    dentist: dentist
      ? `BS. ${dentist.account?.username || dentist.account?.email || "Nha sĩ"}`
      : "",
    cost: totalAmount,
    status: row.status,
    paymentStatus: invoice?.payment_status || "",
    paymentTime: invoice?.payment_time || "",
  };
}

function getTreatmentDentistId(row) {
  return row.work_slot?.schedules?.dentist?.dentist_id || null;
}

function filterTreatmentHistoryByActor(rows, { actorProfileId, actorRole } = {}) {
  if (normalizeRole(actorRole) !== "dentist") {
    return rows;
  }

  return rows.filter(
    (row) => String(getTreatmentDentistId(row)) === String(actorProfileId),
  );
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

async function getTreatmentHistory(patientId, actor = {}) {
  const { data, error } =
    await patientDao.findTreatmentHistoryByPatientId(patientId);

  if (error) {
    throw new AppError(error.message, 500, "DB_ERROR");
  }

  return filterTreatmentHistoryByActor(data || [], actor).map(normalizeTreatment);
}

/**
 * BR-12: Lift a booking ban for a patient by resolving all their No-Show appointments.
 * no_show_count resets automatically via DB trigger once No-Shows are resolved.
 */
async function liftBookingBan(patientId) {
  const patient = await patientDao.findPatientById(patientId);

  if (patient.no_show_count < 3) {
    throw new AppError(
      "This patient does not have an active booking ban.",
      400,
      "NOT_BANNED",
    );
  }

  const resolved = await patientDao.resolveNoShowAppointments(patientId);

  return {
    patientId: patient.patient_id,
    fullName: patient.full_name,
    resolvedCount: resolved.length,
  };
}

module.exports = {
  searchPatients,
  createPatientAccount,
  getTreatmentHistory,
  liftBookingBan,
};
