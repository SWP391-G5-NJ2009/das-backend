const express = require("express");
const treatmentController = require("./treatment.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const requireRole = require("../../middlewares/role.middleware");

const router = express.Router();

router.post(
  "/",
  authMiddleware,
  requireRole("dentist"),
  treatmentController.createTreatment,
);

module.exports = router;
