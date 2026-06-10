// das-backend/src/controllers/payment.controller.js
const paymentService = require("../services/payment.service");
const { sendSuccess } = require("../utils/response");

async function getAllPayments(req, res, next) {
  try {
    const payments = await paymentService.getAllPayments();
    return sendSuccess(res, 200, payments, "Payments retrieved successfully.");
  } catch (err) {
    return next(err);
  }
}

module.exports = { getAllPayments };