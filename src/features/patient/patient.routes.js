const express = require("express");
const patientController = require("./patient.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const requireRole = require("../../middlewares/role.middleware");

const router = express.Router();

router.use(authMiddleware, requireRole("patient"));

router.get("/me", patientController.getMyProfile);
router.patch("/me", patientController.updateMyProfile);
router.get("/me/treatments", patientController.getMyTreatmentHistory);

module.exports = router;
