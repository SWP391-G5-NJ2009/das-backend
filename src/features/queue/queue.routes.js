const express = require("express");
const authMiddleware = require("../../middlewares/auth.middleware");
const requireRole = require("../../middlewares/role.middleware");
const queueController = require("./queue.controller");

const router = express.Router();

router.use(authMiddleware);

router.get(
  "/",
  requireRole("receptionist"),
  queueController.getAllQueues,
);

router.get(
  "/mine",
  requireRole("dentist"),
  queueController.getMyQueue,
);

router.post(
  "/walk-in",
  requireRole("receptionist"),
  queueController.createWalkIn,
);

router.post(
  "/:id/treatment",
  requireRole("dentist"),
  queueController.recordWalkInTreatment,
);

router.get(
  "/:id",
  requireRole("receptionist", "dentist"),
  queueController.getQueueDetail,
);

router.patch(
  "/:id/status",
  requireRole("receptionist", "dentist"),
  queueController.updateStatus,
);

router.post(
  "/:id/follow-ups",
  requireRole("dentist"),
  queueController.createFollowUp,
);

module.exports = router;
