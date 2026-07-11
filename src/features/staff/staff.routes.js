const express = require("express");
const staffController = require("./staff.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const requireRole = require("../../middlewares/role.middleware");

const router = express.Router();

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

router.get(
  "/",
  authMiddleware,
  requireRole("owner"),
  staffController.getAllStaff,
);

module.exports = router;
