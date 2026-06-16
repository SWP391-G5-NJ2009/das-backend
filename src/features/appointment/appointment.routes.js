const express = require("express");
const appointmentController = require("./appointment.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const requireRole = require("../../middlewares/role.middleware");

const router = express.Router();

// All appointment routes require authentication
router.use(authMiddleware);

// Patient: view own appointments
router.get(
  "/my",
  requireRole("patient"),
  appointmentController.getMyAppointments,
);

// Receptionist: view all clinic appointments
router.get(
  "/",
  requireRole("receptionist"),
  appointmentController.getAllAppointments,
);

// Cancel: patient (own) or receptionist
router.patch(
  "/:id/cancel",
  requireRole("patient", "receptionist"),
  appointmentController.cancelAppointment,
);

module.exports = router;
