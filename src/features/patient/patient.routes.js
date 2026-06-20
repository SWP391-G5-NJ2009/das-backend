const express = require("express");
const patientController = require("./patient.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const requireRole = require("../../middlewares/role.middleware");

const router = express.Router();

router.use(authMiddleware);

// Receptionist: search patients by name/phone
router.get("/search", requireRole("receptionist"), patientController.searchPatients);

module.exports = router;
