const express = require("express");
const appointmentController = require("./appointment.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const requireRole = require("../../middlewares/role.middleware");

const router = express.Router();

// All appointment routes require authentication
router.use(authMiddleware);

// Patient: get booked time slots (work_date + start_time) for active appointments
router.get(
  "/my/booked-times",
  requireRole("patient"),
  appointmentController.getMyBookedTimes,
);

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

// Receptionist: check a specific patient's booked time slots (to disable in booking UI)
router.get(
  "/patient-booked-times",
  requireRole("receptionist"),
  appointmentController.getPatientBookedTimesForReceptionist,
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

// Receptionist: manually mark a Confirmed appointment as No-Show
router.patch(
  "/:id/no-show",
  requireRole("receptionist"),
  appointmentController.markNoShow,
);

// Cancel: patient (own) or receptionist
router.patch(
  "/:id/cancel",
  requireRole("patient", "receptionist"),
  appointmentController.cancelAppointment,
);


module.exports = router;
