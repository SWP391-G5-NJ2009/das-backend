const express = require("express");
const authMiddleware = require("../../middlewares/auth.middleware");
const requireRole = require("../../middlewares/role.middleware");
const patientAnalyticsController = require("./patientAnalytics.controller");
const router = express.Router();

router.get(
    "/newPatient",
    authMiddleware,
    requireRole("manager"),
    patientAnalyticsController.getNewPatient,
);

router.get(
    "/noShowRate",
    authMiddleware,
    requireRole("manager"),
    patientAnalyticsController.getNoShowRate,
);

router.get(
    "/returningPatient",
    authMiddleware,
    requireRole("manager"),
    patientAnalyticsController.getReturningPatient,
);

router.get(
    "/newPatientMonthly",
    authMiddleware,
    requireRole("manager"),
    patientAnalyticsController.getMonthlyNewPatient,
);

router.get(
    "/returningPatientMonthly",
    authMiddleware,
    requireRole("manager"),
    patientAnalyticsController.getMonthlyReturningPatient,
);

router.get(
    "/noShowRateMonthly",
    authMiddleware,
    requireRole("manager"),
    patientAnalyticsController.getMonthlyNoShowRate,
);

module.exports = router;
