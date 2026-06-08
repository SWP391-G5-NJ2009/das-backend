const express = require("express");
const consultationController = require("../controllers/consultation.controller");
const authMiddleware = require("../middlewares/auth.middleware");
const requireRole = require("../middlewares/role.middleware");
const router = express.Router();

router.get(
    "/consultation-requests",
    authMiddleware,
    requireRole("receptionist"),
    consultationController.getAllConsultationRequests,
)

router.put(
    "/consultation-requests/:id",
    authMiddleware,
    requireRole("receptionist"),
    consultationController.updateConsultationRequest,
)

module.exports = router;