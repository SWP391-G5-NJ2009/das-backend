const queueDao = require("./queue.dao");
const AppError = require("../../utils/AppError");
const { ACTIVE_QUEUE_STATUSES, QUEUE_STATUSES } = require("./queue.constants");

function normalizeTime(value) {
  return value ? value.substring(0, 5) : null;
}

function normalizeSearchValue(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeQueue(row) {
  if (!row) return null;

  const appointment = row.appointment || null;
  const primaryEntry = (appointment?.appointment_slot || []).find(
    (slot) => slot.is_primary,
  );
  const primarySlot = primaryEntry?.work_slot;
  const slotConfig = primarySlot?.time_slot_config;
  const schedule = primarySlot?.schedules;
  const services = appointment?.appointment_service || [];

  const orderedConfigs = (appointment?.appointment_slot || [])
    .map((entry) => entry.work_slot?.time_slot_config)
    .filter(Boolean)
    .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
  const lastConfig = orderedConfigs[orderedConfigs.length - 1];

  return {
    queueId: String(row.id),
    queueType: row.queue_type,
    appointmentId: row.appointment_id ? String(row.appointment_id) : null,
    appointmentStatus: appointment?.status || null,
    patientId: row.patient?.patient_id || row.patient_id,
    patientName: row.patient?.full_name || "Chưa cập nhật",
    patientPhone: row.patient?.phone || "",
    patientEmail: row.patient?.email || "",
    patientDob: row.patient?.birth_date || null,
    patientGender: row.patient?.gender || null,
    patientAddress: row.patient?.address || "",
    patientNoShowCount: row.patient?.no_show_count ?? 0,
    appointmentDate: schedule?.work_date || null,
    appointmentTime: normalizeTime(slotConfig?.start_time),
    appointmentTimeEnd: normalizeTime(
      lastConfig?.end_time || slotConfig?.end_time,
    ),
    serviceName:
      services
        .map((item) => item.dental_service?.service_name)
        .filter(Boolean)
        .join(", ") || (row.queue_type === "WALK_IN" ? "Walk-in" : ""),
    services: services.map((item) => ({
      serviceId: item.dental_service?.service_id,
      serviceName: item.dental_service?.service_name,
      actualPrice: item.actual_price,
      treatmentMode: item.dental_service?.treatment_mode || "Single-Visit",
      slotOccupied: item.dental_service?.slot_occupied ?? 1,
    })),
    dentistId: row.dentist?.dentist_id || row.dentist_id || null,
    dentistName: row.dentist?.full_name || null,
    dentistSpeciality: row.dentist?.speciality || null,
    roomId: row.room?.room_id || row.room_id || null,
    roomName: row.room?.room_name || null,
    roomStatus: row.room?.status || null,
    status: row.status,
    checkInTime: row.check_in_time,
    waitingMinutes: Math.max(
      0,
      Math.floor((Date.now() - new Date(row.check_in_time).getTime()) / 60000),
    ),
    note: row.note || appointment?.note || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function resolveStatuses(status) {
  if (!status || status === "active") return ACTIVE_QUEUE_STATUSES;
  if (status === "all") return null;
  const requested = String(status)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const allowed = Object.values(QUEUE_STATUSES);
  return requested.filter((item) => allowed.includes(item));
}

function applySearch(rows, search) {
  const keyword = normalizeSearchValue(search);
  if (!keyword) return rows;

  return rows.filter((item) =>
    [
      item.patientName,
      item.patientPhone,
      item.serviceName,
      item.dentistName,
      item.roomName,
    ].some((value) => normalizeSearchValue(value).includes(keyword)),
  );
}

async function getAllQueues(filters = {}) {
  const { data, error } = await queueDao.findAll({
    statuses: resolveStatuses(filters.status),
    dentistId: filters.dentistId,
    roomId: filters.roomId,
  });
  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  return applySearch((data || []).map(normalizeQueue), filters.search);
}

async function getDentistQueues(dentistId, filters = {}) {
  if (!dentistId) {
    throw new AppError("Không tìm thấy hồ sơ nha sĩ.", 403, "FORBIDDEN");
  }
  const { data, error } = await queueDao.findAll({
    dentistId,
    statuses: resolveStatuses(filters.status),
  });
  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  return applySearch((data || []).map(normalizeQueue), filters.search);
}

async function getQueueDetail(queueId, actor = {}) {
  const { data, error } = await queueDao.findById(queueId);
  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  if (!data) throw new AppError("Không tìm thấy lượt hàng đợi.", 404, "NOT_FOUND");
  if (
    actor.role === "dentist" &&
    String(data.dentist_id) !== String(actor.profileId)
  ) {
    throw new AppError("Bạn không có quyền xem lượt này.", 403, "FORBIDDEN");
  }
  return normalizeQueue(data);
}

async function createFollowUp(queueId, payload, actor = {}) {
  const queue = await getQueueDetail(queueId, actor);
  if (actor.role !== "dentist" || !actor.profileId) {
    throw new AppError("Chỉ nha sĩ được tạo thông báo tái khám.", 403, "FORBIDDEN");
  }

  const created = await queueDao.createFollowUp({
    queueId,
    patientId: queue.patientId,
    dentistId: actor.profileId,
    scheduledFor: payload.scheduledFor,
    reason: payload.reason,
  });

  return {
    id: String(created.id),
    queueId: String(created.queue_id),
    scheduledFor: created.scheduled_for,
    reason: created.reason,
    status: created.status,
    createdAt: created.created_at,
  };
}

module.exports = {
  createFollowUp,
  getAllQueues,
  getDentistQueues,
  getQueueDetail,
};
