const express = require("express");
const staffController = require("./staff.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const requireRole = require("../../middlewares/role.middleware");

const router = express.Router();

router.get("/accounts/available", authMiddleware, requireRole("manager"), staffController.getAvailableStaffAccounts);
router.post("/profiles", authMiddleware, requireRole("manager"), staffController.createStaffProfile);

router.get(
  "/dentist-accounts/available",
  authMiddleware,
  requireRole("manager"),
  staffController.getAvailableDentistAccounts,
);

router.post(
  "/dentists",
  authMiddleware,
  requireRole("manager"),
  staffController.createDentistProfile,
);

router.patch(
  "/dentists/:id",
  authMiddleware,
  requireRole("manager"),
  staffController.updateDentistProfile,
);

router.patch(
  "/receptionists/:id",
  authMiddleware,
  requireRole("manager"),
  staffController.updateReceptionistProfile,
);

router.get(
  "/",
  authMiddleware,
  requireRole("manager"),
  staffController.getAllStaff,
);

module.exports = router;
