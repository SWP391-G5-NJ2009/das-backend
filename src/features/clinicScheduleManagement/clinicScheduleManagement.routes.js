const express = require("express");
const authMiddleware = require("../../middlewares/auth.middleware");
const requireRole = require("../../middlewares/role.middleware");
const clinicScheduleManagementController = require("./clinicScheduleManagement.controller");
const router = express.Router();

router.get(
    "/versions",
    authMiddleware,
    requireRole("owner"),
    clinicScheduleManagementController.getVersions,
);

router.post(
    "/versions",
    authMiddleware,
    requireRole("owner"),
    clinicScheduleManagementController.createVersion,
);

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

router.put(
    "/save-all",
    authMiddleware,
    requireRole("owner"),
    clinicScheduleManagementController.saveAll,
);

router.delete(
    "/pending",
    authMiddleware,
    requireRole("owner"),
    clinicScheduleManagementController.cancelPending,
);

router.delete(
    "/versions/:id",
    authMiddleware,
    requireRole("owner"),
    clinicScheduleManagementController.deleteVersion,
);

router.patch(
    "/versions/:id/activate",
    authMiddleware,
    requireRole("owner"),
    clinicScheduleManagementController.activateVersion,
);

router.get(
    "/versions/:id",
    authMiddleware,
    requireRole("owner"),
    clinicScheduleManagementController.getVersionById,
);

router.patch(
    "/versions/:id/effective-date",
    authMiddleware,
    requireRole("owner"),
    clinicScheduleManagementController.updateEffectiveDate,
);

router.get(
    "/min-effective-date",
    authMiddleware,
    requireRole("owner"),
    clinicScheduleManagementController.getMinEffectiveDate,
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

module.exports = router;
