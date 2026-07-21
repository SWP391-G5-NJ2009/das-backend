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

// Receptionist / Dentist: view clinic appointments
router.get(
  "/",
  requireRole("receptionist", "dentist"),
  appointmentController.getAllAppointments,
);

// Book: patient (for themselves) or receptionist (supplies patientId)
router.post(
  "/",
  requireRole("patient", "receptionist"),
  appointmentController.bookAppointment,
);

router.patch(
  "/:id/checkin",
  requireRole("receptionist"),
  appointmentController.checkInAppointment,
);

router.patch(
  "/:id/start-treatment",
  requireRole("dentist"),
  appointmentController.startTreatment,
);

// Cancel: patient (own) or receptionist
router.patch(
  "/:id/cancel",
  requireRole("patient", "receptionist"),
  appointmentController.cancelAppointment,
);

module.exports = router;
