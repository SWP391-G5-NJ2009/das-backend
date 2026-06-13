const express = require("express");
const paymentController = require("./payment.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const requireRole = require("../../middlewares/role.middleware");

const router = express.Router();

router.get(
  "/",
  authMiddleware,
  requireRole("receptionist", "owner", "admin"),
  paymentController.getAllPayments,
);

module.exports = router;
