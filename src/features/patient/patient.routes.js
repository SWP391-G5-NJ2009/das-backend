const express = require("express");
const patientController = require("./patient.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const requireRole = require("../../middlewares/role.middleware");

const router = express.Router();

router.use(authMiddleware);

// Receptionist: search patients by name/phone
router.get(
  "/search",
  requireRole("receptionist"),
  patientController.searchPatients,
);

router.post(
  "/",
  requireRole("receptionist"),
  patientController.createPatientAccount,
);

// Receptionist: lift booking ban for a patient
router.patch(
  "/:patientId/lift-ban",
  requireRole("receptionist"),
  patientController.liftBookingBan,
);

router.use(requireRole("patient"));

router.get("/me/treatments", patientController.getMyTreatmentHistory);

module.exports = router;
