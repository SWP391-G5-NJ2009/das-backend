const express = require("express");
const staffController = require("./staff.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const requireRole = require("../../middlewares/role.middleware");

const router = express.Router();

router.get("/accounts/available", authMiddleware, requireRole("owner"), staffController.getAvailableStaffAccounts);
router.post("/profiles", authMiddleware, requireRole("owner"), staffController.createStaffProfile);

router.get(
  "/dentist-accounts/available",
  authMiddleware,
  requireRole("owner"),
  staffController.getAvailableDentistAccounts,
);

router.post(
  "/dentists",
  authMiddleware,
  requireRole("owner"),
  staffController.createDentistProfile,
);

router.patch(
  "/dentists/:id",
  authMiddleware,
  requireRole("owner"),
  staffController.updateDentistProfile,
);

router.patch(
  "/receptionists/:id",
  authMiddleware,
  requireRole("owner"),
  staffController.updateReceptionistProfile,
);

router.get(
  "/",
  authMiddleware,
  requireRole("owner"),
  staffController.getAllStaff,
);

module.exports = router;
