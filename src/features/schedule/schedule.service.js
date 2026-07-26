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
      managerNote: noteParts.join(":").trim(),
    };
  }

  return {
    label: status || REQUEST_STATUS,
    managerNote: "",
  };
}

function normalizeSchedule(row, roomsByDentist = new Map()) {
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
  const assignedRoom = roomsByDentist.get(Number(row.dentist_id)) || null;

  return {
    id: String(row.schedule_id),
    schedule_id: row.schedule_id,
    dentist_id: row.dentist_id,
    dentistName: row.dentist?.full_name || `Dentist #${row.dentist_id}`,
    date: row.work_date,
    work_date: row.work_date,
    room_id: assignedRoom?.room_id || null,
    roomName: assignedRoom?.room_name
      ? `Room ${assignedRoom.room_name}`
      : "No assigned room",
    roomStatus: assignedRoom?.status || null,
    status: status.label,
    rawStatus: row.status,
    managerNote: status.managerNote,
    startTime: firstSlot?.time_slot_config?.start_time?.substring(0, 5) || "",
    endTime: lastSlot?.time_slot_config?.end_time?.substring(0, 5) || "",
    slotCount: sortedSlots.length,
    slots: sortedSlots.map((slot) => ({
      slot_id: slot.slot_id,
      status: slot.status,
      slot_config_id: slot.time_slot_config.slot_config_id,
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
  const dayOfWeek = toClinicDayOfWeek(workDate);
  const cacheKey = String(dayOfWeek);

  if (!cache.has(cacheKey)) {
    const { data, error } =
      await scheduleDao.findTimeSlotConfigsByDay(dayOfWeek);

    if (error) {
      throw new AppError("Không thể tải khung giờ của phòng khám.", 500, "DB_ERROR");
    }

    cache.set(cacheKey, data || []);
  }

  return cache.get(cacheKey);
}

function deriveWorkingHoursFromSlots(slots = []) {
  const byDay = new Map();

  slots.forEach((slot) => {
    const day = Number(slot.day_of_week);
    if (!day) return;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(slot);
  });

  const ranges = [];

  [...byDay.entries()]
    .sort(([firstDay], [secondDay]) => firstDay - secondDay)
    .forEach(([dayOfWeek, daySlots]) => {
      const sorted = daySlots
        .filter((slot) => slot.start_time && slot.end_time)
        .sort((first, second) =>
          String(first.start_time).localeCompare(String(second.start_time)),
        );

      let current = null;

      sorted.forEach((slot) => {
        if (!current) {
          current = {
            working_hour_id: `${dayOfWeek}-${slot.start_time}`,
            day_of_week: dayOfWeek,
            start_time: slot.start_time,
            end_time: slot.end_time,
          };
          return;
        }

        if (current.end_time === slot.start_time) {
          current.end_time = slot.end_time;
          return;
        }

        ranges.push(current);
        current = {
          working_hour_id: `${dayOfWeek}-${slot.start_time}`,
          day_of_week: dayOfWeek,
          start_time: slot.start_time,
          end_time: slot.end_time,
        };
      });

      if (current) ranges.push(current);
    });

  return ranges;
}

async function buildRoomsByDentistMap() {
  const { data: rooms, error } = await scheduleDao.findAvailableRooms();

  if (error) {
    throw new AppError("Failed to load room assignments.", 500, "DB_ERROR");
  }

  return new Map(
    (rooms || [])
      .filter((room) => room.dentist_id)
      .map((room) => [Number(room.dentist_id), room]),
  );
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
  const [
    { data: rooms, error: roomError },
    { data: slots, error: slotError },
    { data: clinicInfo, error: clinicError },
  ] = await Promise.all([
    scheduleDao.findAvailableRooms(),
    scheduleDao.findTimeSlotConfigs(),
    scheduleDao.findClinicInfo(),
  ]);

  if (
    roomError ||
    slotError ||
    clinicError
  ) {
    throw new AppError(
      "Failed to load schedule setup data.",
      500,
      "DB_ERROR",
    );
  }

  const clinicWindow = buildClinicWindow(slots || [], clinicInfo || {});
  const workingHours = deriveWorkingHoursFromSlots(slots || []);
  const workingDays = [
    ...new Set(
      (workingHours || [])
        .map((hour) => Number(hour.day_of_week))
        .filter(Boolean),
    ),
  ].sort((first, second) => first - second);

  return {
    scheduleVersion: null,
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
      dayOfWeek: hour.day_of_week,
      startTime: hour.start_time.substring(0, 5),
      endTime: hour.end_time.substring(0, 5),
    })),
    timeSlots: (slots || []).map((slot) => ({
      slot_config_id: slot.slot_config_id,
      slotName: slot.slot_name,
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

  const roomsByDentist = await buildRoomsByDentistMap();
  return (data || []).map((row) => normalizeSchedule(row, roomsByDentist));
}

async function listScheduleRequests(filters = {}) {
  const { data, error } = await scheduleDao.findSchedulesForManager(filters);

  if (error) {
    throw new AppError("Không thể tải yêu cầu lịch.", 500, "DB_ERROR");
  }

  const roomsByDentist = await buildRoomsByDentistMap();
  return (data || []).map((row) => normalizeSchedule(row, roomsByDentist));
}

async function listDentistsForSchedule() {
  const [
    { data: dentists, error: dentistError },
    { data: rooms, error: roomError },
  ] = await Promise.all([
    scheduleDao.findDentists(),
    scheduleDao.findAssignedRooms(),
  ]);

  if (dentistError || roomError) {
    throw new AppError("Failed to load dentists.", 500, "DB_ERROR");
  }

  const roomsByDentist = new Map(
    (rooms || [])
      .filter((room) => room.dentist_id)
      .map((room) => [Number(room.dentist_id), room]),
  );

  return (dentists || []).flatMap((dentist) => {
    const assignedRoom = roomsByDentist.get(Number(dentist.dentist_id));
    if (!assignedRoom) return [];

    return [{
      dentist_id: dentist.dentist_id,
      id: String(dentist.dentist_id),
      full_name: dentist.full_name,
      name: dentist.full_name || `Dentist #${dentist.dentist_id}`,
      speciality: dentist.speciality || "",
      email: dentist.email || "",
      phone: dentist.phone || "",
      room_id: assignedRoom?.room_id || null,
      roomName: assignedRoom?.room_name
        ? `Room ${assignedRoom.room_name}`
        : "No assigned room",
    }];
  });
}

async function viewDentistSchedule(filters = {}) {
  const dentistId = Number(filters.dentistId || filters.dentist_id);

  if (!dentistId) {
    throw new AppError("dentistId is required.", 400, "VALIDATION_ERROR");
  }

  const { data, error } = await scheduleDao.findSchedulesForDentistView(
    dentistId,
    filters,
  );

  if (error) {
    throw new AppError("Failed to load dentist schedule.", 500, "DB_ERROR");
  }

  const roomsByDentist = await buildRoomsByDentistMap();
  return (data || []).map((row) => normalizeSchedule(row, roomsByDentist));
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

async function replaceScheduleSlots(scheduleId, slotRows) {
  const { error: deleteError } =
    await scheduleDao.deleteEditableWorkSlots(scheduleId);

  if (deleteError) {
    throw new AppError(
      "Failed to update schedule slots.",
      500,
      "DB_ERROR",
    );
  }

  const rows = slotRows.map((slot) => ({
    schedule_id: scheduleId,
    slot_config_id: slot.slot_config_id,
    status: slot.status,
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
  const busySlotConfigIds = new Set(
    (payload.busySlotConfigIds || payload.busy_slot_config_ids || [])
      .map((slotConfigId) => Number(slotConfigId))
      .filter(Boolean),
  );

  const dates = generateDates(payload);
  assertScheduleSubmissionWindow(dates);
  const savedSchedules = [];
  const slotConfigCache = new Map();

  for (const workDate of dates) {
    const slotConfigs = await getSlotConfigsForWorkDate(
      workDate,
      slotConfigCache,
    );

    if (!slotConfigs?.length) {
      throw new AppError(
        "No configured clinic slots match the selected working day.",
        400,
        "VALIDATION_ERROR",
      );
    }

    const { data: existing, error: lookupError } =
      await scheduleDao.findScheduleByDentistAndDate(dentistId, workDate);

    if (lookupError) {
      throw new AppError("Không thể kiểm tra lịch hiện có.", 500, "DB_ERROR");
    }

    let schedule = existing;
    let preservedSlotConfigIds = new Set();

    if (schedule) {
      const bookedSlots = (schedule.work_slot || []).filter(
        (slot) => slot.status === "Booked",
      );
      const conflictBookedSlotIds = bookedSlots
        .filter((slot) =>
          busySlotConfigIds.has(
            Number(slot.slot_config_id || slot.time_slot_config?.slot_config_id),
          ),
        )
        .map((slot) => slot.slot_id);

      if (conflictBookedSlotIds.length > 0) {
        const affectedAppointments =
          await getAffectedAppointments(conflictBookedSlotIds);

        if (affectedAppointments.length > 0) {
          await markAffectedAppointmentsConflict(
            affectedAppointments,
            payload.reason ||
            "Dentist marked this schedule slot as unavailable.",
          );
        }

        const { error: slotUpdateError } =
          await scheduleDao.updateWorkSlotsByIds(
            conflictBookedSlotIds,
            "Unavailable",
          );

        if (slotUpdateError) {
          throw new AppError(
            "Failed to release conflicting booked slots.",
            500,
            "DB_ERROR",
          );
        }
      }

      preservedSlotConfigIds = new Set(
        bookedSlots
          .filter((slot) => !conflictBookedSlotIds.includes(slot.slot_id))
          .map(
            (slot) =>
              Number(slot.slot_config_id || slot.time_slot_config?.slot_config_id),
          )
          .filter(Boolean),
      );

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

    const slotsToCreate = (slotConfigs || [])
      .filter((slot) => !preservedSlotConfigIds.has(Number(slot.slot_config_id)))
      .map((slot) => ({
        slot_config_id: slot.slot_config_id,
        status: busySlotConfigIds.has(Number(slot.slot_config_id))
          ? "Unavailable"
          : "Available",
      }));

    await replaceScheduleSlots(schedule.schedule_id, slotsToCreate);

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
    const slotConfigs = await getSlotConfigsForWorkDate(existing.work_date);

    if (!slotConfigs?.length) {
      throw new AppError(
        "This schedule request does not contain any working slots.",
        400,
        "SCHEDULE_EMPTY",
      );
    }

    await replaceScheduleSlots(
      scheduleId,
      slotConfigs.map((slot) => ({
        slot_config_id: slot.slot_config_id,
        status: "Available",
      })),
    );
  }

  const { data, error } = await scheduleDao.updateSchedule(scheduleId, {
    status: APPROVED_STATUS,
  });

  if (error || !data?.[0]) {
    throw new AppError("Không thể duyệt lịch.", 500, "DB_ERROR");
  }

  const { data: refreshed } = await scheduleDao.findScheduleById(scheduleId);
  const roomsByDentist = await buildRoomsByDentistMap();
  return normalizeSchedule(refreshed || data[0], roomsByDentist);
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
  const roomsByDentist = await buildRoomsByDentistMap();
  return normalizeSchedule(refreshed || data[0], roomsByDentist);
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
  listDentistsForSchedule,
  getMySchedule,
  getScheduleMeta,
  listScheduleRequests,
  submitMyScheduleRequest,
  updateAvailabilityStatus,
  viewDentistSchedule,
};
