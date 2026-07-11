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

router.put(
    "/workingHour",
    authMiddleware,
    requireRole("owner"),
    clinicScheduleManagementController.updateWorkingHours,
);

router.get(
    "/setting",
    authMiddleware,
    requireRole("owner"),
    clinicScheduleManagementController.getClinicSetting,
);

router.put(
    "/setting",
    authMiddleware,
    requireRole("owner"),
    clinicScheduleManagementController.updateClinicSetting,
);

router.get(
    "/closures",
    authMiddleware,
    requireRole("owner"),
    clinicScheduleManagementController.getClosures,
);

router.post(
    "/closures",
    authMiddleware,
    requireRole("owner"),
    clinicScheduleManagementController.createClosure,
);

router.delete(
    "/closures/:id",
    authMiddleware,
    requireRole("owner"),
    clinicScheduleManagementController.deleteClosure,
);

router.delete(
    "/workingHour/pending",
    authMiddleware,
    requireRole("owner"),
    clinicScheduleManagementController.cancelPendingWorkingHours,
);

router.delete(
    "/setting/pending",
    authMiddleware,
    requireRole("owner"),
    clinicScheduleManagementController.cancelPendingClinicSetting,
);

module.exports = router;