const express = require("express");
const authMiddleware = require("../../middlewares/auth.middleware");
const requireRole = require("../../middlewares/role.middleware");
const clinicScheduleManagementController = require("./clinicScheduleManagement.controller");
const router = express.Router();

router.get(
    "/workingHour",
    authMiddleware,
    requireRole("owner"),
    clinicScheduleManagementController.getWorkingHour,
);

module.exports = router;