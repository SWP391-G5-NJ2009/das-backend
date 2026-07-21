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

async function getPaymentDetail(req, res, next) {
  try {
    const payment = await paymentService.getPaymentDetail(req.params.id);
    return sendSuccess(res, 200, payment, "Lấy chi tiết hóa đơn thành công.");
  } catch (err) {
    return next(err);
  }
}

async function getUnpaidInvoices(req, res, next) {
  try {
    const invoices = await paymentService.getUnpaidInvoices();
    return sendSuccess(res, 200, invoices, "Lấy danh sách hóa đơn chưa thanh toán thành công.");
  } catch (err) {
    return next(err);
  }
}

async function getInvoiceDetail(req, res, next) {
  try {
    const invoice = await paymentService.getInvoiceDetail(req.params.invoiceId);
    return sendSuccess(res, 200, invoice, "Lấy chi tiết hóa đơn thành công.");
  } catch (err) {
    return next(err);
  }
}

async function payInvoice(req, res, next) {
  try {
    const payment = await paymentService.payInvoice(req.params.invoiceId, req.body.paymentMethod);
    return sendSuccess(res, 201, payment, "Thanh toán hóa đơn thành công.");
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getAllPayments,
  getInvoiceDetail,
  getPaymentDetail,
  getUnpaidInvoices,
  payInvoice,
};
