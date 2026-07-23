const express = require("express");
const appointmentDashboardController = require("./appointmentDashboard.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const requireRole = require("../../middlewares/role.middleware");

const router = express.Router();

router.use(authMiddleware);

router.get(
  "/monthly",
  requireRole("manager"),
  appointmentDashboardController.getMonthlyCounts,
);

router.get(
  "/daily",
  requireRole("manager"),
  appointmentDashboardController.getDailyAppointments,
);

module.exports = router;
