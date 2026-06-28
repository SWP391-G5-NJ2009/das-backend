const express = require("express");
const consultationController = require("./consultation.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const rateLimit = require("express-rate-limit");
const requireRole = require("../../middlewares/role.middleware");
const router = express.Router();

const spamLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: { success: false, message: "Too many requests. Please try again later." },
});


router.post("/", spamLimiter, consultationController.createConsultationRequest);

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
