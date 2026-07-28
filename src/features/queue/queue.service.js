const queueDao = require("./queue.dao");
const AppError = require("../../utils/AppError");
const {
  ACTIVE_QUEUE_STATUSES,
  QUEUE_STATUSES,
  QUEUE_STATUS_TRANSITIONS,
  QUEUE_TYPES,
} = require("./queue.constants");

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
  const walkInService = row.service || null;
  const normalizedServices =
    row.queue_type === QUEUE_TYPES.WALK_IN && walkInService
      ? [{ actual_price: row.actual_price, dental_service: walkInService }]
      : services;
  const orderedConfigs = (appointment?.appointment_slot || [])
    .map((entry) => entry.work_slot?.time_slot_config)
    .filter(Boolean)
    .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
  const lastConfig = orderedConfigs[orderedConfigs.length - 1];
  const normalizedStatus =
    row.status === QUEUE_STATUSES.ASSIGNED
      ? QUEUE_STATUSES.WAITING
      : row.status;
  const waitingMinutes = [
    QUEUE_STATUSES.WAITING,
    QUEUE_STATUSES.IN_PROGRESS,
  ].includes(normalizedStatus)
    ? Math.max(
        0,
        Math.floor(
          ((normalizedStatus === QUEUE_STATUSES.WAITING
            ? Date.now()
            : new Date(row.updated_at).getTime()) -
            new Date(row.check_in_time).getTime()) /
            60000,
        ),
      )
    : null;

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
      normalizedServices
        .map((item) => item.dental_service?.service_name)
        .filter(Boolean)
        .join(", ") ||
      (row.queue_type === QUEUE_TYPES.WALK_IN ? "Chưa có dịch vụ" : ""),
    serviceId:
      row.queue_type === QUEUE_TYPES.WALK_IN
        ? walkInService?.service_id || row.service_id || null
        : services[0]?.dental_service?.service_id || null,
    actualPrice:
      row.queue_type === QUEUE_TYPES.WALK_IN
        ? row.actual_price
        : services[0]?.actual_price ?? null,
    services: normalizedServices.map((item) => ({
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
    status: normalizedStatus,
    checkInTime: row.check_in_time,
    waitingMinutes,
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
  if (requested.some((item) => !allowed.includes(item))) {
    throw new AppError(
      "Trạng thái hàng đợi không hợp lệ.",
      400,
      "VALIDATION_ERROR",
    );
  }
  return requested.includes(QUEUE_STATUSES.WAITING)
    ? [...new Set([...requested, QUEUE_STATUSES.ASSIGNED])]
    : requested;
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

async function getQueueRow(queueId) {
  const { data, error } = await queueDao.findById(queueId);
  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  if (!data) {
    throw new AppError(
      "Không tìm thấy lượt trong hàng đợi.",
      404,
      "NOT_FOUND",
    );
  }
  return data;
}

async function getDentist(dentistId) {
  const { data, error } = await queueDao.findDentistById(dentistId);
  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  if (!data) {
    throw new AppError("Không tìm thấy nha sĩ.", 404, "DENTIST_NOT_FOUND");
  }
  return data;
}

async function resolveDentistRoom(dentistId) {
  const dentist = await getDentist(dentistId);
  const assignedRoom = (dentist.room_info || []).find(
    (room) => room.status !== "Unavailable",
  );
  if (!assignedRoom) {
    throw new AppError(
      "Nha sĩ chưa có phòng khám khả dụng.",
      409,
      "DENTIST_ROOM_NOT_FOUND",
    );
  }

  return {
    dentistId: Number(dentist.dentist_id),
    roomId: Number(assignedRoom.room_id),
  };
}

async function getAllQueues(filters = {}) {
  const { data, error } = await queueDao.findAll({
    statuses: resolveStatuses(filters.status),
    dentistId: filters.dentistId,
  });
  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  return applySearch((data || []).map(normalizeQueue), filters.search);
}

async function getDentistQueues(dentistId, filters = {}) {
  if (!dentistId) {
    throw new AppError(
      "Không tìm thấy hồ sơ nha sĩ.",
      403,
      "FORBIDDEN",
    );
  }
  const { data, error } = await queueDao.findAll({
    dentistId,
    statuses:
      filters.status && filters.status !== "active"
        ? resolveStatuses(filters.status)
        : ACTIVE_QUEUE_STATUSES,
  });
  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  return applySearch((data || []).map(normalizeQueue), filters.search);
}

async function getQueueDetail(queueId, actor = {}) {
  const data = await getQueueRow(queueId);
  if (
    actor.role === "dentist" &&
    String(data.dentist_id) !== String(actor.profileId)
  ) {
    throw new AppError(
      "Bạn không có quyền xem lượt này.",
      403,
      "FORBIDDEN",
    );
  }
  return normalizeQueue(data);
}

async function createWalkIn(payload) {
  const { data: patient, error } = await queueDao.findPatientById(
    payload.patientId,
  );
  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  if (!patient) {
    throw new AppError(
      "Không tìm thấy hồ sơ bệnh nhân.",
      404,
      "PATIENT_NOT_FOUND",
    );
  }

  const { data: activeQueue, error: activeQueueError } =
    await queueDao.findActiveByPatientId(payload.patientId);
  if (activeQueueError) {
    throw new AppError(activeQueueError.message, 500, "DB_ERROR");
  }
  if (activeQueue) {
    throw new AppError(
      "Bệnh nhân đang có lượt trong hàng đợi.",
      409,
      "ACTIVE_QUEUE_EXISTS",
    );
  }

  const { data: service, error: serviceError } =
    await queueDao.findActiveServiceById(payload.serviceId);
  if (serviceError) {
    throw new AppError(serviceError.message, 500, "DB_ERROR");
  }
  if (!service) {
    throw new AppError(
      "Không tìm thấy dịch vụ đang hoạt động.",
      404,
      "SERVICE_NOT_FOUND",
    );
  }

  const dentistRoom = await resolveDentistRoom(payload.dentistId);
  const created = await queueDao.createWalkIn({
    appointment_id: null,
    patient_id: Number(payload.patientId),
    dentist_id: dentistRoom.dentistId,
    room_id: dentistRoom.roomId,
    service_id: Number(service.service_id),
    actual_price: Number(service.unit_price),
    queue_type: QUEUE_TYPES.WALK_IN,
    status: QUEUE_STATUSES.WAITING,
    note: payload.note || null,
  });
  return normalizeQueue(created);
}

async function updateStatus(queueId, nextStatus, actor = {}) {
  const queue = await getQueueRow(queueId);
  if (queue.queue_type !== QUEUE_TYPES.WALK_IN) {
    throw new AppError(
      "Trạng thái lượt có lịch hẹn được đồng bộ từ lịch hẹn.",
      409,
      "APPOINTMENT_QUEUE_READ_ONLY",
    );
  }

  if (actor.role === "receptionist") {
    if (nextStatus !== QUEUE_STATUSES.CANCELLED) {
      throw new AppError(
        "Lễ tân chỉ có thể hủy lượt walk-in.",
        403,
        "FORBIDDEN",
      );
    }
  } else if (actor.role === "dentist") {
    if (
      !actor.profileId ||
      String(queue.dentist_id) !== String(actor.profileId)
    ) {
      throw new AppError(
        "Bạn không được cập nhật lượt của nha sĩ khác.",
        403,
        "FORBIDDEN",
      );
    }
    if (
      nextStatus !== QUEUE_STATUSES.IN_PROGRESS
    ) {
      throw new AppError(
        "Nha sĩ chỉ có thể bắt đầu hoặc hoàn tất lượt walk-in.",
        403,
        "FORBIDDEN",
      );
    }
  } else {
    throw new AppError("Bạn không có quyền cập nhật lượt này.", 403, "FORBIDDEN");
  }

  const allowed = QUEUE_STATUS_TRANSITIONS[queue.status] || [];
  if (!allowed.includes(nextStatus)) {
    throw new AppError(
      `Không thể chuyển trạng thái từ ${queue.status} sang ${nextStatus}.`,
      409,
      "INVALID_QUEUE_TRANSITION",
    );
  }

  if (nextStatus === QUEUE_STATUSES.IN_PROGRESS) {
    if (!queue.dentist_id) {
      throw new AppError(
        "Cần phân công nha sĩ trước khi bắt đầu khám.",
        409,
        "DENTIST_REQUIRED",
      );
    }
    const { data, error } = await queueDao.findDentistInProgress(
      queue.dentist_id,
      queue.id,
    );
    if (error) throw new AppError(error.message, 500, "DB_ERROR");
    if (data) {
      throw new AppError(
        "Nha sĩ đang điều trị một bệnh nhân khác.",
        409,
        "DENTIST_BUSY",
      );
    }
  }

  const updated = await queueDao.updateById(
    queueId,
    { status: nextStatus },
    queue.status,
  );
  if (!updated) {
    throw new AppError(
      "Không tìm thấy lượt trong hàng đợi.",
      404,
      "NOT_FOUND",
    );
  }
  return normalizeQueue(updated);
}

async function createFollowUp(queueId, payload, actor = {}) {
  const queue = await getQueueDetail(queueId, actor);
  if (actor.role !== "dentist" || !actor.profileId) {
    throw new AppError(
      "Chỉ nha sĩ được tạo thông báo tái khám.",
      403,
      "FORBIDDEN",
    );
  }
  if (queue.status === QUEUE_STATUSES.CANCELLED) {
    throw new AppError(
      "Không thể tạo tái khám cho lượt đã hủy.",
      409,
      "QUEUE_CANCELLED",
    );
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

async function recordWalkInTreatment(queueId, payload, actor = {}) {
  if (actor.role !== "dentist" || !actor.profileId) {
    throw new AppError("Chỉ nha sĩ được ghi kết quả điều trị.", 403, "FORBIDDEN");
  }
  const queue = await getQueueRow(queueId);
  if (queue.queue_type !== QUEUE_TYPES.WALK_IN) {
    throw new AppError("Lượt khám không phải walk-in.", 409, "QUEUE_NOT_WALK_IN");
  }
  if (queue.status !== QUEUE_STATUSES.IN_PROGRESS) {
    throw new AppError("Chỉ có thể ghi kết quả khi đang khám.", 409, "QUEUE_NOT_IN_PROGRESS");
  }
  if (String(queue.dentist_id) !== String(actor.profileId)) {
    throw new AppError("Bạn không phụ trách lượt khám này.", 403, "FORBIDDEN");
  }
  if (!queue.service_id || queue.actual_price == null) {
    throw new AppError(
      "Lượt walk-in cũ chưa có dịch vụ hoặc giá. Vui lòng cập nhật trước khi ghi kết quả.",
      409,
      "QUEUE_SERVICE_REQUIRED",
    );
  }

  try {
    const result = await queueDao.recordWalkInTreatment({
      queueId: Number(queueId),
      dentistId: Number(actor.profileId),
      ...payload,
    });
    return {
      recordId: result?.record_id,
      invoiceId: result?.invoice_id,
      queueStatus: result?.queue_status,
    };
  } catch (error) {
    const code = error.message?.match(/QUEUE_[A-Z_]+/)?.[0];
    const conflicts = {
      QUEUE_TREATMENT_EXISTS: "Lượt khám đã có kết quả điều trị.",
      QUEUE_INVOICE_EXISTS: "Lượt khám đã có hóa đơn.",
      QUEUE_STATUS_CHANGED: "Trạng thái lượt khám vừa thay đổi. Vui lòng tải lại.",
      QUEUE_NOT_IN_PROGRESS: "Lượt khám không còn ở trạng thái đang khám.",
      QUEUE_SERVICE_REQUIRED: "Lượt walk-in chưa có dịch vụ hoặc giá hợp lệ.",
    };
    if (code && conflicts[code]) {
      throw new AppError(conflicts[code], 409, code);
    }
    throw new AppError(error.message, 500, "DB_ERROR");
  }
}

module.exports = {
  createFollowUp,
  createWalkIn,
  getAllQueues,
  getDentistQueues,
  getQueueDetail,
  recordWalkInTreatment,
  updateStatus,
};
