const express = require("express");
const authMiddleware = require("../../middlewares/auth.middleware");
const requireRole = require("../../middlewares/role.middleware");
const revenueController = require("./revenue.controller");
const router = express.Router();

router.get(
    "/",
    authMiddleware,
    requireRole("owner"),
    revenueController.revenueAnalytics,
);

router.get(
    "/monthly",
    authMiddleware,
    requireRole("owner"),
    revenueController.monthlyRevenueAnalytics,
);

module.exports = router;