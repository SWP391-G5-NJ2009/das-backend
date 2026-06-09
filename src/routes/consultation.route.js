const express = require("express");
const consultationController = require("../controllers/consultation.controller");
const router = express.Router();

router.post("/consultations", consultationController.createConsultationRequest);
router.get(
  "/consultation-requests",
  authMiddleware,
  requireRole("receptionist"),
  consultationController.getAllConsultationRequests,
);

router.put(
  "/consultation-requests/:id",
  authMiddleware,
  requireRole("receptionist"),
  consultationController.updateConsultationRequest,
);
module.exports = router;
