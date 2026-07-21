const express = require("express");
const consultationController = require("./consultation.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const rateLimit = require("express-rate-limit");
const requireRole = require("../../middlewares/role.middleware");
const router = express.Router();

const spamLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { success: false, message: "Quá nhiều yêu cầu. Vui lòng thử lại sau." },
});


router.post("/", spamLimiter, consultationController.createConsultationRequest);

router.get(
  "/consultation-requests",
  authMiddleware,
  requireRole("receptionist"),
  consultationController.getAllConsultationRequests,
);

router.patch(
  "/consultation-requests/:id",
  authMiddleware,
  requireRole("receptionist"),
  consultationController.updateConsultationRequest,
);
module.exports = router;
