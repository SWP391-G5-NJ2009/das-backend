const scheduleDao = require("./schedule.dao");
const AppError = require("../../utils/AppError");
const textbeeService = require("../../integrations/textbee/textbee.service");
const logger = require("../../utils/logger");

const MAX_RANGE_DAYS = 31;
const REQUEST_STATUS = "Pending";
const APPROVED_STATUS = "Scheduled";
const DENIED_PREFIX = "Denied";

function toDate(value, fieldName) {
  const date = new Date(`${value}T00:00:00`);

  if (!value || Number.isNaN(date.getTime())) {
    throw new AppError(`${fieldName} is invalid.`, 400, "VALIDATION_ERROR");
  }

  return date;
}

function toIsoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeTime(value, fieldName) {
  const text = String(value || "").trim();

  if (!/^\d{2}:\d{2}$/.test(text)) {
    throw new AppError(`${fieldName} must use HH:mm format.`, 400, "VALIDATION_ERROR");
  }

  return `${text}:00`;
}

function getNextMonthBounds(referenceDate = new Date()) {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const start = new Date(year, month + 1, 1);
  const end = new Date(year, month + 2, 0);

  return {
    start,
    end,
    startDate: toIsoDate(start),
    endDate: toIsoDate(end),
  };
}

function assertScheduleSubmissionWindow(dates) {
  const now = new Date();
  const currentDay = now.getDate();
  const nextMonth = getNextMonthBounds(now);

  if (currentDay > 15) {
    throw new AppError(
      "Dentists can only create or edit next month's schedule from day 1 to day 15 of the current month.",
      400,
      "SCHEDULE_WINDOW_CLOSED",
      {
        allowedFromDay: 1,
        allowedToDay: 15,
        targetMonthStart: nextMonth.startDate,
        targetMonthEnd: nextMonth.endDate,
      },
    );
  }

  const outsideNextMonth = dates.some(
    (date) => date < nextMonth.startDate || date > nextMonth.endDate,
  );

  if (outsideNextMonth) {
    throw new AppError(
      "Dentists must set schedules for next month only.",
      400,
      "SCHEDULE_MONTH_INVALID",
      {
        targetMonthStart: nextMonth.startDate,
        targetMonthEnd: nextMonth.endDate,
      },
    );
  }
}

function parseScheduleStatus(rawStatus) {
  const status = String(rawStatus || "").trim();

  if (status.toLowerCase().startsWith(DENIED_PREFIX.toLowerCase())) {
    const [, ...noteParts] = status.split(":");

    return {
      label: DENIED_PREFIX,
      ownerNote: noteParts.join(":").trim(),
    };
  }

  return {
    label: status || REQUEST_STATUS,
    ownerNote: "",
  };
}

function normalizeSchedule(row) {
  const sortedSlots = [...(row.work_slot || [])]
    .filter((slot) => slot.time_slot_config)
    .sort((firstSlot, secondSlot) =>
      String(firstSlot.time_slot_config.start_time || "").localeCompare(
        String(secondSlot.time_slot_config.start_time || ""),
      ),
    );
  const firstSlot = sortedSlots[0];
  const lastSlot = sortedSlots[sortedSlots.length - 1];
  const status = parseScheduleStatus(row.status);

  return {
    id: String(row.schedule_id),
    schedule_id: row.schedule_id,
    dentist_id: row.dentist_id,
    dentistName: row.dentist?.full_name || `Dentist #${row.dentist_id}`,
    date: row.work_date,
    work_date: row.work_date,
    status: status.label,
    rawStatus: row.status,
    ownerNote: status.ownerNote,
    startTime: firstSlot?.time_slot_config?.start_time?.substring(0, 5) || "",
    endTime: lastSlot?.time_slot_config?.end_time?.substring(0, 5) || "",
    slotCount: sortedSlots.length,
    slots: sortedSlots.map((slot) => ({
      slot_id: slot.slot_id,
      status: slot.status,
      slot_config_id: slot.time_slot_config.slot_config_id,
      versionId: slot.time_slot_config.version_id,
      dayOfWeek: slot.time_slot_config.day_of_week,
      startTime: slot.time_slot_config.start_time.substring(0, 5),
      endTime: slot.time_slot_config.end_time.substring(0, 5),
    })),
  };
}

function generateDates({ startDate, endDate, weekdays }) {
  const start = toDate(startDate, "startDate");
  const end = toDate(endDate, "endDate");

  if (start > end) {
    throw new AppError("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.", 400, "VALIDATION_ERROR");
  }

  const diffDays = Math.floor((end - start) / 86400000) + 1;
  if (diffDays > MAX_RANGE_DAYS) {
    throw new AppError(
      `Schedule range cannot exceed ${MAX_RANGE_DAYS} days.`,
      400,
      "VALIDATION_ERROR",
    );
  }

  const weekdaySet = new Set(
    (weekdays || []).map((day) => Number(day)).filter((day) => day >= 0 && day <= 6),
  );

  if (weekdaySet.size === 0) {
    throw new AppError("Vui lòng chọn ít nhất một ngày làm việc.", 400, "VALIDATION_ERROR");
  }

  const dates = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    if (weekdaySet.has(cursor.getDay())) {
      dates.push(toIsoDate(cursor));
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  if (dates.length === 0) {
    throw new AppError(
      "No dates matched the selected range and working days.",
      400,
      "VALIDATION_ERROR",
    );
  }

  return dates;
}

function toClinicDayOfWeek(dateText) {
  const day = toDate(dateText, "workDate").getDay();
  return day === 0 ? 7 : day;
}

function buildClinicWindow(slots = [], fallback = {}) {
  const startTimes = slots.map((slot) => slot.start_time).filter(Boolean).sort();
  const endTimes = slots.map((slot) => slot.end_time).filter(Boolean).sort();

  return {
    openTime:
      (startTimes[0] || fallback.open_time || "08:00:00").substring(0, 5),
    closeTime:
      (endTimes[endTimes.length - 1] || fallback.close_time || "20:00:00")
        .substring(0, 5),
  };
}

async function getSlotConfigsForWorkDate(workDate, cache = new Map()) {
  const { data: version, error: versionError } =
    await scheduleDao.findClinicScheduleVersionForDate(workDate);

  if (versionError || !version) {
    throw new AppError(
      "No clinic working-hour version is available for the selected date.",
      400,
      "CLINIC_SCHEDULE_VERSION_NOT_FOUND",
    );
  }

  const dayOfWeek = toClinicDayOfWeek(workDate);
  const cacheKey = `${version.version_id}:${dayOfWeek}`;

  if (!cache.has(cacheKey)) {
    const { data, error } =
      await scheduleDao.findTimeSlotConfigsByVersionAndDay(
        version.version_id,
        dayOfWeek,
      );

    if (error) {
      throw new AppError("Không thể tải khung giờ của phòng khám.", 500, "DB_ERROR");
    }

    cache.set(cacheKey, data || []);
  }

  return cache.get(cacheKey);
}

function selectSlotConfigs(slotConfigs, startTime, endTime) {
  const start = normalizeTime(startTime, "startTime");
  const end = normalizeTime(endTime, "endTime");

  if (start >= end) {
    throw new AppError("Giờ kết thúc phải sau giờ bắt đầu.", 400, "VALIDATION_ERROR");
  }

  const selected = slotConfigs.filter(
    (slot) => slot.start_time >= start && slot.end_time <= end,
  );

  if (!selected.length) {
    throw new AppError(
      "No configured clinic slots match the selected working hours.",
      400,
      "VALIDATION_ERROR",
    );
  }

  return selected;
}

async function resolveDentistId(user) {
  if (user?.profileId) return Number(user.profileId);

  const { data, error } = await scheduleDao.findDentistByAccountId(user?.id);

  if (error || !data) {
    throw new AppError("Không tìm thấy hồ sơ nha sĩ.", 404, "DENTIST_NOT_FOUND");
  }

  return data.dentist_id;
}

async function getScheduleMeta() {
  const nextMonth = getNextMonthBounds();
  const { data: clinicVersion, error: clinicVersionError } =
    await scheduleDao.findClinicScheduleVersionForDate(nextMonth.startDate);
  const slotConfigRequest = clinicVersion
    ? scheduleDao.findTimeSlotConfigsByVersion(clinicVersion.version_id)
    : Promise.resolve({ data: [], error: null });
  const workingHourRequest = clinicVersion
    ? scheduleDao.findWorkingHoursByVersion(clinicVersion.version_id)
    : Promise.resolve({ data: [], error: null });
  const [
    { data: rooms, error: roomError },
    { data: slots, error: slotError },
    { data: workingHours, error: workingHourError },
    { data: clinicInfo, error: clinicError },
  ] = await Promise.all([
    scheduleDao.findAvailableRooms(),
    slotConfigRequest,
    workingHourRequest,
    scheduleDao.findClinicInfo(),
  ]);

  if (
    roomError ||
    slotError ||
    workingHourError ||
    clinicError ||
    clinicVersionError
  ) {
    throw new AppError(
      "Failed to load schedule setup data.",
      500,
      "DB_ERROR",
    );
  }

  const clinicWindow = buildClinicWindow(slots || [], clinicInfo || {});
  const workingDays = [
    ...new Set(
      (workingHours || [])
        .map((hour) => Number(hour.day_of_week))
        .filter(Boolean),
    ),
  ].sort((first, second) => first - second);

  return {
    scheduleVersion: clinicVersion
      ? {
          versionId: clinicVersion.version_id,
          name: clinicVersion.name,
          effectiveDate: clinicVersion.effective_date,
          status: clinicVersion.status,
        }
      : null,
    clinic: {
      openTime: clinicWindow.openTime,
      closeTime: clinicWindow.closeTime,
    },
    scheduleWindow: {
      isOpen: new Date().getDate() <= 15,
      allowedFromDay: 1,
      allowedToDay: 15,
      targetMonthStart: nextMonth.startDate,
      targetMonthEnd: nextMonth.endDate,
    },
    rooms: rooms || [],
    workingDays,
    workingHours: (workingHours || []).map((hour) => ({
      workingHourId: hour.working_hour_id,
      versionId: hour.version_id,
      dayOfWeek: hour.day_of_week,
      startTime: hour.start_time.substring(0, 5),
      endTime: hour.end_time.substring(0, 5),
    })),
    timeSlots: (slots || []).map((slot) => ({
      slot_config_id: slot.slot_config_id,
      slotName: slot.slot_name,
      versionId: slot.version_id,
      dayOfWeek: slot.day_of_week,
      startTime: slot.start_time.substring(0, 5),
      endTime: slot.end_time.substring(0, 5),
    })),
  };
}

async function getMySchedule(user, filters = {}) {
  const dentistId = await resolveDentistId(user);
  const { data, error } = await scheduleDao.findSchedulesByDentist(
    dentistId,
    filters,
  );

  if (error) {
    throw new AppError("Không thể tải lịch của bạn.", 500, "DB_ERROR");
  }

  return (data || []).map(normalizeSchedule);
}

async function listScheduleRequests(filters = {}) {
  const { data, error } = await scheduleDao.findSchedulesForOwner(filters);

  if (error) {
    throw new AppError("Không thể tải yêu cầu lịch.", 500, "DB_ERROR");
  }

  return (data || []).map(normalizeSchedule);
}

function normalizeAffectedAppointment(row) {
  const appointment = row.appointment || {};
  const services = (appointment.appointment_service || [])
    .map((item) => item.dental_service?.service_name)
    .filter(Boolean);
  const slotConfig = row.work_slot?.time_slot_config;
  const workDate = row.work_slot?.schedules?.work_date;

  return {
    appointmentId: appointment.appt_id,
    patientName: appointment.patient?.full_name || "Unknown patient",
    patientPhone: appointment.patient?.phone || "",
    patientEmail: appointment.patient?.email || "",
    serviceName: services.join(", ") || "Dental service",
    date: workDate || "",
    time: slotConfig?.start_time ? slotConfig.start_time.substring(0, 5) : "",
    timeEnd: slotConfig?.end_time ? slotConfig.end_time.substring(0, 5) : "",
  };
}

async function getAffectedAppointments(slotIds) {
  if (!slotIds.length) return [];

  const { data, error } =
    await scheduleDao.findAffectedAppointmentsBySlotIds(slotIds);

  if (error) {
    throw new AppError(
      "Failed to check affected appointments.",
      500,
      "DB_ERROR",
    );
  }

  const byAppointment = new Map();

  (data || []).forEach((row) => {
    const normalized = normalizeAffectedAppointment(row);
    if (!byAppointment.has(normalized.appointmentId)) {
      byAppointment.set(normalized.appointmentId, normalized);
    }
  });

  return [...byAppointment.values()];
}

function conflictSmsMessage(appointment, reason) {
  return [
    `Nha Khoa Smile Care: Lich hen ngay ${appointment.date} luc ${appointment.time}`,
    "can sap xep lai do bac si dot xuat khong kha dung.",
    reason ? `Ly do: ${reason}.` : "",
    "Le tan se lien he ban som nhat.",
  ]
    .filter(Boolean)
    .join(" ");
}

async function notifyAffectedAppointments(affectedAppointments, reason) {
  const delivery = [];

  for (const appointment of affectedAppointments) {
    let smsStatus = "skipped";

    if (appointment.patientPhone) {
      try {
        await textbeeService.sendSms({
          recipient: appointment.patientPhone,
          message: conflictSmsMessage(appointment, reason),
        });
        smsStatus = "sent";
      } catch (error) {
        smsStatus = error.code || "failed";
        logger.warn("MSG26 SMS notification failed.", {
          appointmentId: appointment.appointmentId,
          patientPhone: appointment.patientPhone,
          error: error.message,
        });
      }
    }

    if (appointment.patientEmail) {
      logger.info("MSG26 email notification queued by log.", {
        appointmentId: appointment.appointmentId,
        patientEmail: appointment.patientEmail,
        reason,
      });
    }

    delivery.push({
      appointmentId: appointment.appointmentId,
      smsStatus,
      emailStatus: appointment.patientEmail ? "logged" : "skipped",
    });
  }

  if (affectedAppointments.length > 0) {
    logger.warn("Urgent receptionist rescheduling task generated.", {
      reason,
      affectedAppointments,
    });
  }

  return {
    delivery,
    receptionistTask: affectedAppointments.length
      ? {
          type: "RESCHEDULE_CONFLICT",
          priority: "Urgent",
          affectedAppointments,
        }
      : null,
  };
}

async function markAffectedAppointmentsConflict(affectedAppointments, reason) {
  if (!affectedAppointments.length) {
    return { updated: [], notifications: { delivery: [], receptionistTask: null } };
  }

  const apptIds = affectedAppointments.map((item) => item.appointmentId);
  const { data, error } = await scheduleDao.updateAppointmentsToConflict(
    apptIds,
    reason,
  );

  if (error) {
    throw new AppError(
      "Failed to flag affected appointments for rescheduling.",
      500,
      "DB_ERROR",
    );
  }

  const notifications = await notifyAffectedAppointments(
    affectedAppointments,
    reason,
  );

  logger.warn("ActivityLog: Dentist availability force-blocked appointments.", {
    affectedAppointmentIds: apptIds,
    reason,
  });

  return { updated: data || [], notifications };
}

async function replaceScheduleSlots(scheduleId, selectedSlotConfigs, status) {
  const { error: deleteError } =
    await scheduleDao.deleteEditableWorkSlots(scheduleId);

  if (deleteError) {
    throw new AppError(
      "Failed to update schedule slots.",
      500,
      "DB_ERROR",
    );
  }

  const rows = selectedSlotConfigs.map((slot) => ({
    schedule_id: scheduleId,
    slot_config_id: slot.slot_config_id,
    status,
  }));
  const { error: insertError } = await scheduleDao.insertWorkSlots(rows);

  if (insertError) {
    throw new AppError(
      "Failed to save schedule slots.",
      500,
      "DB_ERROR",
    );
  }
}

async function submitMyScheduleRequest(user, payload = {}) {
  const dentistId = await resolveDentistId(user);
  const dates = generateDates(payload);
  assertScheduleSubmissionWindow(dates);
  const savedSchedules = [];
  const slotConfigCache = new Map();

  for (const workDate of dates) {
    const slotConfigs = await getSlotConfigsForWorkDate(
      workDate,
      slotConfigCache,
    );
    const selectedSlots = selectSlotConfigs(
      slotConfigs || [],
      payload.startTime || payload.start_time,
      payload.endTime || payload.end_time,
    );
    const { data: existing, error: lookupError } =
      await scheduleDao.findScheduleByDentistAndDate(dentistId, workDate);

    if (lookupError) {
      throw new AppError("Không thể kiểm tra lịch hiện có.", 500, "DB_ERROR");
    }

    let schedule = existing;
    let preservedSlotConfigIds = new Set();

    if (schedule) {
      const existingSlotIds = (schedule.work_slot || []).map(
        (slot) => slot.slot_id,
      );
      preservedSlotConfigIds = new Set(
        (schedule.work_slot || [])
          .filter((slot) => slot.status === "Booked")
          .map(
            (slot) =>
              slot.slot_config_id || slot.time_slot_config?.slot_config_id,
          )
          .filter(Boolean),
      );
      const affectedAppointments = await getAffectedAppointments(existingSlotIds);

      if (affectedAppointments.length > 0) {
        await markAffectedAppointmentsConflict(
          affectedAppointments,
          payload.reason ||
            "Dentist changed their work schedule for this period.",
        );
      }

      const { data: updated, error: updateError } =
        await scheduleDao.updateSchedule(schedule.schedule_id, {
          status: REQUEST_STATUS,
        });

      if (updateError || !updated?.[0]) {
        throw new AppError("Không thể cập nhật yêu cầu lịch.", 500, "DB_ERROR");
      }

      schedule = updated[0];
    } else {
      const { data: inserted, error: insertError } =
        await scheduleDao.insertSchedule({
          dentist_id: dentistId,
          work_date: workDate,
          status: REQUEST_STATUS,
        });

      if (insertError || !inserted?.[0]) {
        throw new AppError("Không thể tạo yêu cầu lịch.", 500, "DB_ERROR");
      }

      schedule = inserted[0];
    }

    const slotsToCreate = selectedSlots.filter(
      (slot) => !preservedSlotConfigIds.has(slot.slot_config_id),
    );

    await replaceScheduleSlots(
      schedule.schedule_id,
      slotsToCreate,
      "Unavailable",
    );

    const { data: refreshed } = await scheduleDao.findScheduleById(
      schedule.schedule_id,
    );
    savedSchedules.push(normalizeSchedule(refreshed || schedule));
  }

  return savedSchedules;
}

async function approveScheduleRequest(scheduleId) {
  const { data: existing, error: lookupError } =
    await scheduleDao.findScheduleById(scheduleId);

  if (lookupError || !existing) {
    throw new AppError("Không tìm thấy yêu cầu lịch.", 404, "NOT_FOUND");
  }

  if (!existing.work_slot?.length) {
    throw new AppError(
      "This schedule request does not contain any working slots.",
      400,
      "SCHEDULE_EMPTY",
    );
  }

  const { data, error } = await scheduleDao.updateSchedule(scheduleId, {
    status: APPROVED_STATUS,
  });

  if (error || !data?.[0]) {
    throw new AppError("Không thể duyệt lịch.", 500, "DB_ERROR");
  }

  const { error: slotError } = await scheduleDao.updateWorkSlotsStatus(
    scheduleId,
    "Available",
  );

  if (slotError) {
    throw new AppError(
      "Schedule approved, but slots could not be published.",
      500,
      "DB_ERROR",
    );
  }

  const { data: refreshed } = await scheduleDao.findScheduleById(scheduleId);
  return normalizeSchedule(refreshed || data[0]);
}

async function denyScheduleRequest(scheduleId, payload = {}) {
  const note = String(payload.reason || payload.note || "").trim();

  if (!note) {
    throw new AppError("Cần nhập ghi chú khi từ chối lịch.", 400, "VALIDATION_ERROR");
  }

  const deniedStatus = `${DENIED_PREFIX}: ${note.slice(0, 180)}`;
  const { data, error } = await scheduleDao.updateSchedule(scheduleId, {
    status: deniedStatus,
  });

  if (error || !data?.[0]) {
    throw new AppError("Không thể từ chối yêu cầu lịch.", 500, "DB_ERROR");
  }

  const { error: slotError } = await scheduleDao.updateWorkSlotsStatus(
    scheduleId,
    "Unavailable",
  );

  if (slotError) {
    throw new AppError(
      "Schedule denied, but slots could not be closed.",
      500,
      "DB_ERROR",
    );
  }

  const { data: refreshed } = await scheduleDao.findScheduleById(scheduleId);
  return normalizeSchedule(refreshed || data[0]);
}

async function updateAvailabilityStatus(user, payload = {}) {
  const dentistId = await resolveDentistId(user);
  const reason = String(payload.reason || "").trim();
  const scope = payload.scope || "slots";
  const force = Boolean(payload.force);
  let slotIds = (payload.slotIds || payload.slot_ids || [])
    .map((slotId) => Number(slotId))
    .filter(Boolean);

  if (scope === "shift" || payload.scheduleId || payload.schedule_id) {
    const scheduleId = Number(payload.scheduleId || payload.schedule_id);

    if (!scheduleId) {
      throw new AppError("Thiếu scheduleId.", 400, "VALIDATION_ERROR");
    }

    const { data: schedule, error: scheduleError } =
      await scheduleDao.findScheduleById(scheduleId);

    if (scheduleError || !schedule) {
      throw new AppError("Không tìm thấy lịch.", 404, "NOT_FOUND");
    }

    if (Number(schedule.dentist_id) !== Number(dentistId)) {
      throw new AppError("Bạn không có quyền truy cập.", 403, "FORBIDDEN");
    }

    if (schedule.status !== APPROVED_STATUS) {
      throw new AppError(
        "Only published schedules can be blocked.",
        400,
        "SCHEDULE_NOT_PUBLISHED",
      );
    }

    slotIds = (schedule.work_slot || []).map((slot) => slot.slot_id);
  }

  if (!slotIds.length) {
    throw new AppError("Vui lòng chọn ít nhất một khung giờ.", 400, "VALIDATION_ERROR");
  }

  if (!reason) {
    throw new AppError("Vui lòng nhập lý do.", 400, "VALIDATION_ERROR");
  }

  const { data: slots, error: slotError } =
    await scheduleDao.findWorkSlotsByIdsForDentist(slotIds, dentistId);

  if (slotError) {
    throw new AppError("Không thể tải các khung giờ đã chọn.", 500, "DB_ERROR");
  }

  if (!slots || slots.length !== slotIds.length) {
    throw new AppError(
      "One or more selected slots were not found for this dentist.",
      404,
      "SLOT_NOT_FOUND",
    );
  }

  const unpublished = slots.find(
    (slot) => slot.schedules?.status !== APPROVED_STATUS,
  );

  if (unpublished) {
    throw new AppError(
      "Only published schedule slots can be updated.",
      400,
      "SCHEDULE_NOT_PUBLISHED",
    );
  }

  const alreadyUnavailable = slots.every(
    (slot) => slot.status === "Unavailable",
  );

  if (alreadyUnavailable) {
    throw new AppError(
      "Selected slots are already unavailable.",
      400,
      "SLOT_ALREADY_UNAVAILABLE",
    );
  }

  const affectedAppointments = await getAffectedAppointments(slotIds);
  const bookedWithoutActiveConflict = slots.filter(
    (slot) => slot.status === "Booked",
  );

  if (bookedWithoutActiveConflict.length > 0 && affectedAppointments.length === 0) {
    throw new AppError(
      "Booked slots cannot be blocked until the linked appointment is resolved.",
      409,
      "SLOT_ALREADY_BOThành côngED",
      {
        slotIds: bookedWithoutActiveConflict.map((slot) => slot.slot_id),
      },
    );
  }

  if (affectedAppointments.length > 0 && !force) {
    throw new AppError(
      "MSG25: Selected slots already have confirmed appointments.",
      409,
      "SLOT_HAS_CONFIRMED_APPOINTMENTS",
      {
        affectedAppointments,
        options: ["cancel", "force_block"],
      },
    );
  }

  let conflictResult = {
    updated: [],
    notifications: { delivery: [], receptionistTask: null },
  };

  if (affectedAppointments.length > 0) {
    conflictResult = await markAffectedAppointmentsConflict(
      affectedAppointments,
      reason,
    );
  }

  const { data: updatedSlots, error: updateError } =
    await scheduleDao.updateWorkSlotsByIds(slotIds, "Unavailable");

  if (updateError) {
    throw new AppError(
      "Failed to update slot availability.",
      500,
      "DB_ERROR",
    );
  }

  logger.info("ActivityLog: Dentist updated availability status.", {
    dentistId,
    slotIds,
    reason,
    force,
    affectedAppointments,
  });

  return {
    message:
      affectedAppointments.length > 0
        ? "MSG26: Slots blocked and affected appointments flagged for rescheduling."
        : "MSG24: Cập nhật trạng thái khả dụng thành công.",
    affectedAppointments,
    updatedSlots: updatedSlots || [],
    conflictAppointments: conflictResult.updated,
    notifications: conflictResult.notifications,
  };
}

module.exports = {
  approveScheduleRequest,
  denyScheduleRequest,
  getMySchedule,
  getScheduleMeta,
  listScheduleRequests,
  submitMyScheduleRequest,
  updateAvailabilityStatus,
};
