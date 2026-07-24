const appointmentDao = require("./appointment.dao");
const patientDao = require("../patient/patient.dao");
const AppError = require("../../utils/AppError");

async function bookAppointment({
  patientId,
  newPatient,
  slotId,
  serviceId,
  note,
  actorAccountId,
  actorRole,
  slotOccupied = 1,
  consultationRequestId = null,
}) {
  let resolvedPatientId = patientId;
  if (!resolvedPatientId && newPatient) {
    const created = await patientDao.createPatient(newPatient);
    resolvedPatientId = created.patient_id;
  }
  if (!resolvedPatientId) {
    throw new AppError(
      "Không thể xác định bệnh nhân.",
      400,
      "VALIDATION_ERROR",
    );
  }

  // BR-11: Block patient with >= 3 No-Shows from booking online
  if (actorRole === "patient") {
    const patientInfo = await patientDao.findPatientById(resolvedPatientId);
    if (patientInfo.no_show_count >= 3) {
      throw new AppError(
        "Tài khoản của bạn đã bị hạn chế đặt lịch trực tuyến do vắng mặt từ 3 lần trở lên. " +
          "Vui lòng liên hệ trực tiếp với phòng khám để được hỗ trợ.",
        403,
        "BOOKING_BANNED_NO_SHOW",
      );
    }
  }
  // End BR-11

  // BR-14: Validate slot timing before attempting to claim it

  const slotInfo = await appointmentDao.findSlotInfo(slotId);
  if (!slotInfo) {
    throw new AppError("Không tìm thấy khung giờ.", 404, "NOT_FOUND");
  }

  const workDate = slotInfo.schedules?.work_date; // "YYYY-MM-DD"
  const startTime = slotInfo.time_slot_config?.start_time; // "HH:MM:SS"
  const endTime = slotInfo.time_slot_config?.end_time; // "HH:MM:SS"

  if (workDate && startTime) {
    const now = new Date();

    if (actorRole === "receptionist") {
      // Receptionist: cho phép đặt miễn là slot chưa kết thúc (dùng end_time)
      const slotEndTime = endTime || startTime; // fallback về start_time nếu không có end_time
      const slotEndDateTime = new Date(`${workDate}T${slotEndTime}`);
      if (slotEndDateTime.getTime() <= now.getTime()) {
        throw new AppError(
          "Khung giờ này đã kết thúc và không thể đặt lịch nữa.",
          400,
          "SLOT_PAST",
        );
      }
    } else {
      // Patient (và các role khác): chặn nếu start_time đã qua
      const slotDateTime = new Date(`${workDate}T${startTime}`);
      const diffMs = slotDateTime.getTime() - now.getTime();

      if (diffMs <= 0) {
        throw new AppError(
          "Khung giờ này đã qua và không thể đặt lịch nữa.",
          400,
          "SLOT_PAST",
        );
      }

      // Block patients only: slot starts within 30 minutes
      if (actorRole === "patient" && diffMs < 30 * 60 * 1000) {
        throw new AppError(
          "Lịch hẹn phải được đặt trước ít nhất 30 phút.",
          400,
          "SLOT_TOO_SOON",
        );
      }
    }
  }
  // End BR-14

  // BR-15: One active appointment per service per patient (patient only)
  if (actorRole === "patient") {
    const conflict = await appointmentDao.findConfirmedAppointmentByService(
      resolvedPatientId,
      serviceId,
    );
    if (conflict) {
      throw new AppError(
        "Bạn đã có một lịch hẹn đang hoạt động cho dịch vụ này " +
          `(trạng thái hiện tại: ${conflict.status}). ` +
          "Vui lòng chờ đến khi lịch hẹn đủ điều kiện trước khi đặt lịch mới.",
        409,
        "DUPLICATE_SERVICE_BOOKING",
      );
    }
  }
  // End BR-15

  // BR-19: A patient cannot have two active appointments at the same date+time, even with different dentists.
  if (workDate && startTime) {
    const slotConflict =
      await appointmentDao.findActiveAppointmentByPatientAtTime(
        resolvedPatientId,
        workDate,
        startTime,
      );
    if (slotConflict) {
      throw new AppError(
        "Bệnh nhân đã có một lịch hẹn vào khung giờ này. Vui lòng chọn khung giờ khác.",
        409,
        "DUPLICATE_SLOT_BOOKING",
      );
    }
  }
  // End BR-19

  // Multi-slot: find all consecutive slots this service requires
  const normalizedSlotCount = Math.max(1, Number(slotOccupied) || 1);

  let allSlotIds;
  if (normalizedSlotCount === 1) {
    const claimedSlot = await appointmentDao.markSlotBooked(slotId);
    if (!claimedSlot) {
      throw new AppError(
        "Khung giờ này vừa được đặt bởi người khác. Vui lòng chọn khung giờ khác.",
        409,
        "SLOT_TAKEN",
      );
    }
    allSlotIds = [slotId];
  } else {
    // Multi-slot: validate consecutive slots exist and are all Available
    const consecutiveSlots = await appointmentDao.findConsecutiveSlotsFromId(
      slotId,
      normalizedSlotCount,
    );

    if (consecutiveSlots.length < normalizedSlotCount) {
      throw new AppError(
        `Dịch vụ này yêu cầu ${normalizedSlotCount} khung giờ liên tiếp, nhưng chỉ cón ${consecutiveSlots.length} khung giờ trống ở cuối lịch này. Vui lòng chọn giờ sớm hơn.`,
        409,
        "INSUFFICIENT_CONSECUTIVE_SLOTS",
      );
    }

    // Validate all required slots are Available before claiming any
    const unavailable = consecutiveSlots.filter(
      (s) => s.status !== "Available",
    );
    if (unavailable.length > 0) {
      throw new AppError(
        "Một hoặc nhiều khung giờ liên tiếp cần thiết không còn trống. Vui lòng chọn giờ bắt đầu khác.",
        409,
        "SLOT_TAKEN",
      );
    }

    // Atomically claim all slots
    const slotIdsToClaim = consecutiveSlots.map((s) => s.slot_id);
    const claimedIds =
      await appointmentDao.markMultipleSlotsBooked(slotIdsToClaim);
    if (!claimedIds) {
      throw new AppError(
        "Một hoặc nhiều khung giờ liên tiếp vừa bị đặt bởi người khác. Vui lòng chọn giờ bắt đầu khác.",
        409,
        "SLOT_TAKEN",
      );
    }
    allSlotIds = claimedIds;
  }

  const appointment = await appointmentDao.createAppointment({
    patient_id: resolvedPatientId,
    status: "Confirmed",
    note: note || null,
    book_time: new Date().toISOString(),
    ...(consultationRequestId
      ? { consultation_request_id: consultationRequestId }
      : {}),
  });

  // Step 3: Look up service price then link service to the appointment
  const actualPrice = await appointmentDao.getServicePrice(serviceId);
  await appointmentDao.insertAppointmentServices([
    {
      appt_id: appointment.appt_id,
      service_id: serviceId,
      actual_price: actualPrice,
    },
  ]);

  await appointmentDao.insertAppointmentSlots(
    allSlotIds.map((sid) => ({
      appt_id: appointment.appt_id,
      slot_id: Number(sid),
      is_primary: Number(sid) === Number(slotId),
    })),
  );

  return appointment;
}

const CANCELLABLE_STATUSES = ["Confirmed", "Checked-in", "Conflict", "No-Show"];

async function checkInAppointment(apptId) {
  const { data: existing, error } = await appointmentDao.findById(apptId);

  if (error || !existing) {
    throw new AppError("Không tìm thấy lịch hẹn.", 404, "NOT_FOUND");
  }
  const checkInStatuses = ["Confirmed", "No-Show"];
  if (!checkInStatuses.includes(existing.status)) {
    throw new AppError(
      "Chỉ có thể check-in lịch hẹn đã xác nhận.",
      409,
      "INVALID_STATUS_TRANSITION",
    );
  }

  const primarySlot = (existing.appointment_slot || []).find(
    (slot) => slot.is_primary,
  );
  const appointmentDate = primarySlot?.work_slot?.schedules?.work_date;
  if (!appointmentDate) {
    throw new AppError(
      "Lịch hẹn không có ngày khám hợp lệ nên không thể check-in.",
      409,
      "CHECK_IN_DATE_MISSING",
    );
  }
  const clinicDateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const clinicDate = Object.fromEntries(
    clinicDateParts.map(({ type, value }) => [type, value]),
  );
  const today = `${clinicDate.year}-${clinicDate.month}-${clinicDate.day}`;
  if (appointmentDate < today) {
    throw new AppError(
      "Lịch hẹn đã qua ngày khám nên không thể check-in.",
      409,
      "CHECK_IN_DATE_EXPIRED",
    );
  }
  if (appointmentDate > today) {
    throw new AppError(
      "Chỉ có thể check-in trong đúng ngày hẹn.",
      409,
      "CHECK_IN_DATE_NOT_REACHED",
    );
  }

  const appointment = await appointmentDao.checkInById(apptId, existing.status);
  if (!appointment) {
    throw new AppError(
      "Trạng thái lịch hẹn vừa thay đổi. Vui lòng tải lại danh sách.",
      409,
      "APPOINTMENT_STATUS_CHANGED",
    );
  }
  if (existing.status === "No-Show") {
    await appointmentDao.reconcileNoShowAfterCheckIn(
      existing.patient?.patient_id,
    );
  }
  return appointment;
}

async function startTreatment(apptId, dentistId) {
  const { data: existing, error } = await appointmentDao.findById(apptId);
  if (error || !existing) {
    throw new AppError("Không tìm thấy lịch hẹn.", 404, "NOT_FOUND");
  }

  const primarySlot = (existing.appointment_slot || []).find(
    (slot) => slot.is_primary,
  );
  const assignedDentistId =
    primarySlot?.work_slot?.schedules?.dentist?.dentist_id;
  if (String(assignedDentistId) !== String(dentistId)) {
    throw new AppError(
      "Bạn không phải bác sĩ phụ trách lịch hẹn này.",
      403,
      "FORBIDDEN",
    );
  }
  if (existing.status !== "Checked-in") {
    throw new AppError(
      "Chỉ có thể bắt đầu điều trị cho bệnh nhân đã check-in.",
      409,
      "INVALID_STATUS_TRANSITION",
    );
  }

  const { data: activeAppointments, error: activeError } =
    await appointmentDao.findAll({ status: "In-Treatment" });
  if (activeError) {
    throw new AppError(activeError.message, 500, "DB_ERROR");
  }
  const activeAppointment = (activeAppointments || []).find((appointment) => {
    const activePrimarySlot = (appointment.appointment_slot || []).find(
      (slot) => slot.is_primary,
    );
    const activeDentistId =
      activePrimarySlot?.work_slot?.schedules?.dentist?.dentist_id;
    return (
      String(activeDentistId) === String(dentistId) &&
      String(appointment.appt_id) !== String(apptId)
    );
  });
  if (activeAppointment) {
    throw new AppError(
      `Bạn đang điều trị cho ${activeAppointment.patient?.full_name || "một bệnh nhân khác"}. Vui lòng hoàn tất ca hiện tại trước.`,
      409,
      "DENTIST_ALREADY_TREATING",
    );
  }

  const appointment = await appointmentDao.startTreatmentById(apptId);
  if (!appointment) {
    throw new AppError(
      "Trạng thái lịch hẹn vừa thay đổi. Vui lòng tải lại danh sách.",
      409,
      "APPOINTMENT_STATUS_CHANGED",
    );
  }
  return appointment;
}

function normalize(row) {
  const primarySlotEntry = (row.appointment_slot || []).find(
    (as) => as.is_primary,
  );
  const primarySlot = primarySlotEntry?.work_slot;
  const slotConfig = primarySlot?.time_slot_config;
  const schedule = primarySlot?.schedules;
  const dentist = schedule?.dentist;

  return {
    id: String(row.appt_id),
    patientId: row.patient?.patient_id || row.patient_id || null,
    patientName: row.patient?.full_name || null,
    patientPhone: row.patient?.phone || null,
    patientEmail: row.patient?.email || null,
    patientDob: row.patient?.birth_date || null,
    patientGender: row.patient?.gender || null,
    patientAddress: row.patient?.address || null,
    patientNoShowCount: row.patient?.no_show_count ?? 0,
    patientAccountStatus: row.patient?.account?.status || null,

    serviceName:
      (row.appointment_service || [])
        .map((item) => item.dental_service?.service_name)
        .filter(Boolean)
        .join(", ") || null,
    services: (row.appointment_service || []).map((as) => ({
      serviceId: as.dental_service?.service_id,
      serviceName: as.dental_service?.service_name,
      actualPrice: as.actual_price,
      slotOccupied: as.dental_service?.slot_occupied ?? 1,
    })),
    slotOccupied: (row.appointment_service || []).reduce(
      (sum, as) => sum + (as.dental_service?.slot_occupied ?? 1),
      0,
    ),
    dentistName: dentist?.full_name || null,
    dentistId: dentist?.dentist_id || null,
    dentistSpeciality: dentist?.speciality || null,
    dentistExperience: dentist?.experience || null,
    scheduledDate: schedule?.work_date || null,
    scheduledTime: slotConfig?.start_time
      ? slotConfig.start_time.substring(0, 5)
      : null,
    scheduledTimeEnd: (() => {
      const allSlots = (row.appointment_slot || [])
        .map((as) => as.work_slot?.time_slot_config)
        .filter(Boolean)
        .sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
      const lastSlotConfig = allSlots[allSlots.length - 1];
      const endTime = lastSlotConfig?.end_time || slotConfig?.end_time;
      return endTime ? endTime.substring(0, 5) : null;
    })(),
    status: row.status,
    notes: row.note || "",
    bookTime: row.book_time,
    totalEstimatedAmount: row.total_estimated_amount || null,
    roomId: dentist?.room_info?.[0]?.room_id || null,
    roomName: dentist?.room_info?.[0]?.room_name || null,
    treatmentRecord: row.treatment_record?.[0] || null,
    invoice: row.invoice?.[0] || null,
  };
}

function applyClientFilters(list, filters) {
  let result = list;

  if (filters.date) {
    result = result.filter((a) => a.scheduledDate === filters.date);
  } else if (filters.month) {
    result = result.filter((a) => a.scheduledDate?.startsWith(filters.month));
  } else if (filters.year) {
    result = result.filter((a) => a.scheduledDate?.startsWith(filters.year));
  }

  if (filters.search) {
    const q = filters.search.toLowerCase();
    result = result.filter(
      (a) =>
        a.patientName?.toLowerCase().includes(q) ||
        a.serviceName?.toLowerCase().includes(q) ||
        a.dentistName?.toLowerCase().includes(q) ||
        a.patientPhone?.includes(q),
    );
  }

  if (filters.dentistId) {
    result = result.filter(
      (a) => String(a.dentistId) === String(filters.dentistId),
    );
  }

  return result;
}

async function getMyAppointments(patientId, filters = {}) {
  const { data, error } = await appointmentDao.findByPatientId(
    patientId,
    filters,
  );

  if (error) {
    throw new AppError(error.message, 500, "DB_ERROR");
  }

  return applyClientFilters((data || []).map(normalize), filters);
}

async function getAll(filters = {}) {
  const { data, error } = await appointmentDao.findAll(filters);

  if (error) {
    throw new AppError(error.message, 500, "DB_ERROR");
  }

  return applyClientFilters((data || []).map(normalize), filters);
}

async function cancelAppointment(
  apptId,
  actorAccountId,
  reason,
  role,
  patientId,
) {
  const { data: existing, error } = await appointmentDao.findById(apptId);

  if (error || !existing) {
    throw new AppError("Không tìm thấy lịch hẹn.", 404, "NOT_FOUND");
  }

  if (
    role === "patient" &&
    existing.patient?.patient_id !== Number(patientId)
  ) {
    throw new AppError("Bạn không có quyền truy cập.", 403, "FORBIDDEN");
  }

  if (!CANCELLABLE_STATUSES.includes(existing.status)) {
    throw new AppError(
      `Không thể hủy lịch hẹn có trạng thái "${existing.status}".`,
      400,
      "INVALID_STATUS_TRANSITION",
    );
  }

  // BR-13: Patients can only cancel at least 24 hours before scheduled time
  if (role === "patient") {
    const primarySlotEntry = (existing.appointment_slot || []).find(
      (as) => as.is_primary,
    );
    const slotId = primarySlotEntry?.work_slot?.slot_id;
    if (slotId) {
      const slotInfo = await appointmentDao.findSlotInfo(slotId);
      if (slotInfo) {
        const workDate = slotInfo.schedules?.work_date;
        const startTime = slotInfo.time_slot_config?.start_time;
        if (workDate && startTime) {
          const slotDateTime = new Date(`${workDate}T${startTime}`);
          const diffMs = slotDateTime.getTime() - Date.now();
          if (diffMs < 24 * 60 * 60 * 1000) {
            throw new AppError(
              "Chỉ có thể hủy lịch hẹn trước ít nhất 24 giờ so với giờ đã đặt. Vui lòng liên hệ trực tiếp với lễ tân để được hỗ trợ.",
              400,
              "CANCEL_TOO_LATE",
            );
          }
        }
      }
    }
  }
  // End BR-13

  const cancelled = await appointmentDao.cancelById(
    apptId,
    actorAccountId,
    reason,
  );

  // Nếu appointment đang là No-Show, giảm ngay no_show_count trước khi return
  if (existing.status === "No-Show") {
    const patientId = existing.patient?.patient_id;
    if (patientId) {
      try {
        await appointmentDao.reconcileNoShowAfterCheckIn(patientId);
      } catch (err) {
        console.error(
          "[appointment.service] no_show_count decrement failed:",
          err.message,
        );
      }
    }
  }

  appointmentDao
    .findSlotsByApptId(apptId)
    .then((slotIds) => {
      if (slotIds.length > 0) {
        return appointmentDao.releaseSlotsByIds(slotIds);
      }
      const primarySlotId = existing.work_slot?.slot_id;
      if (primarySlotId) {
        return appointmentDao.releaseSlotsByIds([primarySlotId]);
      }
    })
    .catch((err) =>
      console.error("[appointment.service] slot release failed:", err.message),
    );

  return cancelled;
}

/**
 * Receptionist: manually mark a Confirmed appointment as No-Show.
 * Increments the patient's no_show_count.
 */
async function markNoShow(apptId) {
  const { data: existing, error } = await appointmentDao.findById(apptId);
  if (error || !existing) {
    throw new AppError("Không tìm thấy lịch hẹn.", 404, "NOT_FOUND");
  }
  if (existing.status !== "Confirmed") {
    throw new AppError(
      `Chỉ có thể đánh dấu No-Show cho lịch hẹn ở trạng thái Đã xác nhận (hiện tại: ${existing.status}).`,
      409,
      "INVALID_STATUS_TRANSITION",
    );
  }

  const updated = await appointmentDao.markOneAsNoShow(apptId);
  if (!updated) {
    throw new AppError(
      "Trạng thái lịch hẹn vừa thay đổi. Vui lòng tải lại danh sách.",
      409,
      "APPOINTMENT_STATUS_CHANGED",
    );
  }

  // Increment no_show_count for this patient
  const patientId = existing.patient?.patient_id;
  if (patientId) {
    const supabase = require("../../config/supabase");
    const { data: patient } = await supabase
      .from("patient")
      .select("patient_id, no_show_count")
      .eq("patient_id", patientId)
      .maybeSingle();
    if (patient) {
      await supabase
        .from("patient")
        .update({ no_show_count: (patient.no_show_count || 0) + 1 })
        .eq("patient_id", patientId);
    }
  }

  return updated;
}


async function getMyBookedTimes(patientId) {
  const { data, error } = await appointmentDao.findByPatientId(patientId);
  if (error) throw new AppError(error.message, 500, "DB_ERROR");

  const ACTIVE_STATUSES = ["Confirmed", "Checked-in", "Conflict"];
  const bookedTimes = [];

  for (const appt of data || []) {
    if (!ACTIVE_STATUSES.includes(appt.status)) continue;
    for (const slotEntry of appt.appointment_slot || []) {
      const slot = slotEntry.work_slot;
      const workDate = slot?.schedules?.work_date;
      const startTime = slot?.time_slot_config?.start_time;
      if (workDate && startTime) {
        bookedTimes.push({ date: workDate, startTime: startTime.slice(0, 5) });
      }
    }
  }

  return bookedTimes;
}


module.exports = {
  bookAppointment,
  cancelAppointment,
  checkInAppointment,
  getAll,
  getMyAppointments,
  getMyBookedTimes,
  markNoShow,
  startTreatment,
};

