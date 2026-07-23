const express = require("express");
const paymentController = require("./payment.controller");
const authMiddleware = require("../../middlewares/auth.middleware");
const requireRole = require("../../middlewares/role.middleware");

const router = express.Router();

router.get(
  "/me",
  authMiddleware,
  requireRole("patient"),
  paymentController.getMyPaymentHistory,
);

router.get(
  "/me/:id",
  authMiddleware,
  requireRole("patient"),
  paymentController.getMyPaymentDetail,
);

router.get(
  "/",
  authMiddleware,
  requireRole("receptionist", "manager", "admin"),
  paymentController.getAllPayments,
);

router.get(
  "/unpaid-invoices",
  authMiddleware,
  requireRole("receptionist", "manager", "admin"),
  paymentController.getUnpaidInvoices,
);

router.get(
  "/invoices/:invoiceId",
  authMiddleware,
  requireRole("receptionist", "manager", "admin"),
  paymentController.getInvoiceDetail,
);

router.post(
  "/invoices/:invoiceId/pay",
  authMiddleware,
  requireRole("receptionist"),
  paymentController.payInvoice,
);

router.get(
  "/:id",
  authMiddleware,
  requireRole("receptionist", "manager", "admin"),
  paymentController.getPaymentDetail,
);

module.exports = router;
