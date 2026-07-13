const paymentService = require("./payment.service");
const { sendSuccess } = require("../../utils/response");

async function getAllPayments(req, res, next) {
  try {
    const payments = await paymentService.getAllPayments();
    return sendSuccess(res, 200, payments, "Lấy danh sách thanh toán thành công.");
  } catch (err) {
    return next(err);
  }
}

module.exports = { getAllPayments };
