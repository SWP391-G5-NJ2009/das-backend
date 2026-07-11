const express = require("express");
const authMiddleware = require("../../middlewares/auth.middleware");
const requireRole = require("../../middlewares/role.middleware");
const patientAnalyticsController = require("./patientAnalytics.controller");
const router = express.Router();

router.get(
    "/newPatient",
    authMiddleware,
    requireRole("owner"),
    patientAnalyticsController.getNewPatient,
);

router.get(
    "/noShowRate",
    authMiddleware,
    requireRole("owner"),
    patientAnalyticsController.getNoShowRate,
);

router.get(
    "/returningPatient",
    authMiddleware,
    requireRole("owner"),
    patientAnalyticsController.getReturningPatient,
);

router.get(
    "/newPatientMonthly",
    authMiddleware,
    requireRole("owner"),
    patientAnalyticsController.getMonthlyNewPatient,
);

router.get(
    "/returningPatientMonthly",
    authMiddleware,
    requireRole("owner"),
    patientAnalyticsController.getMonthlyReturningPatient,
);

module.exports = router;