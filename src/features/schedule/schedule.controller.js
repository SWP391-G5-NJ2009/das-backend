const scheduleService = require("./schedule.service");
const { sendSuccess } = require("../../utils/response");

async function getScheduleMeta(req, res, next) {
  try {
    const meta = await scheduleService.getScheduleMeta();
    return sendSuccess(res, 200, meta, "Schedule setup data retrieved.");
  } catch (error) {
    return next(error);
  }
}

async function getMySchedule(req, res, next) {
  try {
    const schedules = await scheduleService.getMySchedule(req.user, req.query);
    return sendSuccess(res, 200, schedules, "Schedule retrieved successfully.");
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
      "Schedule requests retrieved successfully.",
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
  listScheduleRequests,
  submitMyScheduleRequest,
  updateAvailabilityStatus,
};
