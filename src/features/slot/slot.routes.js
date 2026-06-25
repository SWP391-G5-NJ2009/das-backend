const express = require("express");
const slotController = require("./slot.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const requireRole = require("../../middlewares/role.middleware");

const router = express.Router();

router.use(authMiddleware);

// Patient and receptionist can view available slots
router.get("/", requireRole("patient", "receptionist"), slotController.getAvailableSlots);

module.exports = router;
