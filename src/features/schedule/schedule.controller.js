const scheduleService = require("./schedule.service");
const { sendSuccess } = require("../../utils/response");

async function getScheduleMeta(req, res, next) {
  try {
    const meta = await scheduleService.getScheduleMeta();
    return sendSuccess(res, 200, meta, "Lấy dữ liệu thiết lập lịch thành công.");
  } catch (error) {
    return next(error);
  }
}

async function getMySchedule(req, res, next) {
  try {
    const schedules = await scheduleService.getMySchedule(req.user, req.query);
    return sendSuccess(res, 200, schedules, "Lấy lịch thành công.");
  } catch (error) {
    return next(error);
  }
}

async function submitMyScheduleRequest(req, res, next) {
  try {
    const schedules = await scheduleService.submitMyScheduleRequest(
      req.user,
      req.body,
    );
    return sendSuccess(
      res,
      201,
      schedules,
      "MSG22: Schedule request sent for owner approval.",
    );
  } catch (error) {
    return next(error);
  }
}

async function listScheduleRequests(req, res, next) {
  try {
    const schedules = await scheduleService.listScheduleRequests(req.query);
    return sendSuccess(
      res,
      200,
      schedules,
      "Lấy danh sách yêu cầu lịch thành công.",
    );
  } catch (error) {
    return next(error);
  }
}

async function listDentistsForSchedule(req, res, next) {
  try {
    const dentists = await scheduleService.listDentistsForSchedule();
    return sendSuccess(
      res,
      200,
      dentists,
      "Dentists retrieved successfully.",
    );
  } catch (error) {
    return next(error);
  }
}

async function viewDentistSchedule(req, res, next) {
  try {
    const schedules = await scheduleService.viewDentistSchedule(req.query);
    return sendSuccess(
      res,
      200,
      schedules,
      "Dentist schedule retrieved successfully.",
    );
  } catch (error) {
    return next(error);
  }
}

async function approveScheduleRequest(req, res, next) {
  try {
    const schedule = await scheduleService.approveScheduleRequest(
      req.params.scheduleId,
    );
    return sendSuccess(
      res,
      200,
      schedule,
      "MSG22: Schedule accepted and published to booking calendar.",
    );
  } catch (error) {
    return next(error);
  }
}

async function denyScheduleRequest(req, res, next) {
  try {
    const schedule = await scheduleService.denyScheduleRequest(
      req.params.scheduleId,
      req.body,
    );
    return sendSuccess(
      res,
      200,
      schedule,
      "MSG23: Schedule request denied.",
    );
  } catch (error) {
    return next(error);
  }
}

async function updateAvailabilityStatus(req, res, next) {
  try {
    const result = await scheduleService.updateAvailabilityStatus(
      req.user,
      req.body,
    );
    return sendSuccess(res, 200, result, result.message);
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  approveScheduleRequest,
  denyScheduleRequest,
  getMySchedule,
  getScheduleMeta,
  listDentistsForSchedule,
  listScheduleRequests,
  submitMyScheduleRequest,
  updateAvailabilityStatus,
  viewDentistSchedule,
};
