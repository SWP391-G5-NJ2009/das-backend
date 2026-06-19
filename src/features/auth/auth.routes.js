const express = require("express");
const authController = require("./auth.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const requireRole = require("../../middlewares/role.middleware");

const router = express.Router();

router.post("/patient/login", authController.patientLogin);
router.post("/staff/login", authController.staffLogin);
router.post("/forgot-password", authController.forgotPassword);
router.post("/forgot-password/staff", authController.staffForgotPassword);
router.post("/verify-otp", authController.verifyOtp);
router.post("/reset-password", authController.resetPassword);

router.post("/logout", authMiddleware, authController.logout);
router.patch(
  "/change-password",
  authMiddleware,
  requireRole("patient", "receptionist", "dentist", "owner", "admin"),
  authController.changePassword,
);

module.exports = router;
