const express = require("express");
const scheduleController = require("./schedule.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const requireRole = require("../../middlewares/role.middleware");

const router = express.Router();

router.get(
  "/meta",
  authMiddleware,
  requireRole("dentist", "manager", "admin"),
  scheduleController.getScheduleMeta,
);

router.get(
  "/me",
  authMiddleware,
  requireRole("dentist"),
  scheduleController.getMySchedule,
);

router.post(
  "/me/requests",
  authMiddleware,
  requireRole("dentist"),
  scheduleController.submitMyScheduleRequest,
);

router.patch(
  "/me/availability",
  authMiddleware,
  requireRole("dentist"),
  scheduleController.updateAvailabilityStatus,
);

router.get(
  "/dentists",
  authMiddleware,
  requireRole("receptionist", "manager", "admin"),
  scheduleController.listDentistsForSchedule,
);

router.get(
  "/view",
  authMiddleware,
  requireRole("receptionist", "manager", "admin"),
  scheduleController.viewDentistSchedule,
);

router.get(
  "/requests",
  authMiddleware,
  requireRole("manager", "admin"),
  scheduleController.listScheduleRequests,
);

router.patch(
  "/requests/:scheduleId/approve",
  authMiddleware,
  requireRole("manager", "admin"),
  scheduleController.approveScheduleRequest,
);

router.patch(
  "/requests/:scheduleId/deny",
  authMiddleware,
  requireRole("manager", "admin"),
  scheduleController.denyScheduleRequest,
);

module.exports = router;
