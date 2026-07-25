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
  const orderedConfigs = (appointment?.appointment_slot || [])
    .map((entry) => entry.work_slot?.time_slot_config)
    .filter(Boolean)
    .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
  const lastConfig = orderedConfigs[orderedConfigs.length - 1];
  const waitUntil =
    row.started_at || row.completed_at || new Date().toISOString();

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
        .join(", ") || (row.queue_type === QUEUE_TYPES.WALK_IN ? "Walk-in" : ""),
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
    startedAt: row.started_at || null,
    completedAt: row.completed_at || null,
    waitingMinutes: Math.max(
      0,
      Math.floor(
        (new Date(waitUntil).getTime() -
          new Date(row.check_in_time).getTime()) /
          60000,
      ),
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
  if (requested.some((item) => !allowed.includes(item))) {
    throw new AppError(
      "Trạng thái hàng đợi không hợp lệ.",
      400,
      "VALIDATION_ERROR",
    );
  }
  return requested;
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

async function getAvailableRoom(roomId) {
  const { data, error } = await queueDao.findRoomById(roomId);
  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  if (!data) {
    throw new AppError("Không tìm thấy phòng khám.", 404, "ROOM_NOT_FOUND");
  }
  if (data.status === "Unavailable") {
    throw new AppError(
      "Phòng khám đang không khả dụng.",
      409,
      "ROOM_UNAVAILABLE",
    );
  }
  return data;
}

async function resolveAssignment(dentistId, roomId) {
  if (!dentistId) {
    return { dentistId: null, roomId: null };
  }

  const dentist = await getDentist(dentistId);
  let resolvedRoomId = roomId || null;
  if (!resolvedRoomId) {
    const assignedRoom = (dentist.room_info || []).find(
      (room) => room.status !== "Unavailable",
    );
    resolvedRoomId = assignedRoom?.room_id || null;
  } else {
    await getAvailableRoom(resolvedRoomId);
  }
  if (!resolvedRoomId) {
    throw new AppError(
      "Nha sĩ chưa có phòng khám khả dụng.",
      409,
      "DENTIST_ROOM_NOT_FOUND",
    );
  }

  return {
    dentistId: Number(dentist.dentist_id),
    roomId: resolvedRoomId ? Number(resolvedRoomId) : null,
  };
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
        : [QUEUE_STATUSES.ASSIGNED, QUEUE_STATUSES.IN_PROGRESS],
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

  const assignment = await resolveAssignment(
    payload.dentistId,
    payload.roomId,
  );
  const created = await queueDao.createWalkIn({
    appointment_id: null,
    patient_id: Number(payload.patientId),
    dentist_id: assignment.dentistId,
    room_id: assignment.roomId,
    queue_type: QUEUE_TYPES.WALK_IN,
    status: assignment.dentistId
      ? QUEUE_STATUSES.ASSIGNED
      : QUEUE_STATUSES.WAITING,
    note: payload.note || null,
  });
  return normalizeQueue(created);
}

async function assignQueue(queueId, payload) {
  const queue = await getQueueRow(queueId);
  if (queue.queue_type !== QUEUE_TYPES.WALK_IN) {
    throw new AppError(
      "Lượt có lịch hẹn phải được phân công qua lịch hẹn.",
      409,
      "APPOINTMENT_QUEUE_READ_ONLY",
    );
  }
  if (
    ![QUEUE_STATUSES.WAITING, QUEUE_STATUSES.ASSIGNED].includes(queue.status)
  ) {
    throw new AppError(
      "Không thể phân công lượt đã kết thúc.",
      409,
      "QUEUE_FINISHED",
    );
  }

  const hasDentist = Object.prototype.hasOwnProperty.call(
    payload,
    "dentistId",
  );
  const hasRoom = Object.prototype.hasOwnProperty.call(payload, "roomId");
  const nextDentistId = hasDentist ? payload.dentistId : queue.dentist_id;
  let assignment;

  if (!nextDentistId) {
    assignment = { dentistId: null, roomId: null };
  } else if (hasDentist) {
    assignment = await resolveAssignment(
      nextDentistId,
      hasRoom ? payload.roomId : null,
    );
  } else if (hasRoom) {
    assignment = await resolveAssignment(nextDentistId, payload.roomId);
  } else {
    assignment = {
      dentistId: Number(nextDentistId),
      roomId: queue.room_id ? Number(queue.room_id) : null,
    };
  }

  const updated = await queueDao.updateById(queueId, {
    dentist_id: assignment.dentistId,
    room_id: assignment.roomId,
    status: assignment.dentistId
      ? QUEUE_STATUSES.ASSIGNED
      : QUEUE_STATUSES.WAITING,
    ...(Object.prototype.hasOwnProperty.call(payload, "note")
      ? { note: payload.note || null }
      : {}),
  }, queue.status);
  if (!updated) {
    throw new AppError(
      "Không tìm thấy lượt trong hàng đợi.",
      404,
      "NOT_FOUND",
    );
  }
  return normalizeQueue(updated);
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
    if (nextStatus !== QUEUE_STATUSES.IN_PROGRESS) {
      throw new AppError(
        "Nha sĩ chỉ có thể bắt đầu lượt walk-in; lưu kết quả điều trị sẽ hoàn tất lượt.",
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

  const now = new Date().toISOString();
  const updated = await queueDao.updateById(queueId, {
    status: nextStatus,
    ...(nextStatus === QUEUE_STATUSES.IN_PROGRESS
      ? { started_at: now }
      : {}),
    ...([QUEUE_STATUSES.COMPLETED, QUEUE_STATUSES.CANCELLED].includes(
      nextStatus,
    )
      ? { completed_at: now }
      : {}),
  }, queue.status);
  if (!updated) {
    throw new AppError(
      "Không tìm thấy lượt trong hàng đợi.",
      404,
      "NOT_FOUND",
    );
  }
  return normalizeQueue(updated);
}

async function createTreatmentRecord(queueId, payload, actor = {}) {
  const queue = await getQueueRow(queueId);
  if (queue.queue_type !== QUEUE_TYPES.WALK_IN) {
    throw new AppError(
      "Lượt có lịch hẹn dùng hồ sơ điều trị của lịch hẹn.",
      409,
      "APPOINTMENT_TREATMENT_REQUIRED",
    );
  }
  if (
    actor.role !== "dentist" ||
    !actor.profileId ||
    String(queue.dentist_id) !== String(actor.profileId)
  ) {
    throw new AppError(
      "Bạn không được ghi kết quả cho lượt của nha sĩ khác.",
      403,
      "FORBIDDEN",
    );
  }
  if (queue.status !== QUEUE_STATUSES.IN_PROGRESS) {
    throw new AppError(
      "Chỉ có thể ghi kết quả khi bệnh nhân đang khám.",
      409,
      "INVALID_QUEUE_STATUS",
    );
  }

  const record = await queueDao.createTreatmentRecord({
    queue_id: Number(queue.id),
    patient_id: Number(queue.patient_id),
    dentist_id: Number(actor.profileId),
    clinical_examination: payload.clinicalExamination || null,
    diagnosis: payload.diagnosis,
    treatment_note: payload.treatmentNote,
    post_treatment_instructions:
      payload.postTreatmentInstructions || null,
  });

  try {
    const completedAt = new Date().toISOString();
    const completedQueue = await queueDao.updateById(
      queueId,
      {
        status: QUEUE_STATUSES.COMPLETED,
        completed_at: completedAt,
      },
      QUEUE_STATUSES.IN_PROGRESS,
    );
    if (!completedQueue) {
      throw new AppError(
        "Trạng thái lượt vừa thay đổi. Vui lòng tải lại hàng đợi.",
        409,
        "QUEUE_STATUS_CHANGED",
      );
    }
    return {
      recordId: String(record.record_id),
      queueId: String(record.queue_id),
      status: QUEUE_STATUSES.COMPLETED,
      createdAt: record.created_at,
    };
  } catch (error) {
    await queueDao.removeTreatmentRecord(record.record_id);
    throw error;
  }
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

module.exports = {
  assignQueue,
  createFollowUp,
  createTreatmentRecord,
  createWalkIn,
  getAllQueues,
  getDentistQueues,
  getQueueDetail,
  updateStatus,
};
