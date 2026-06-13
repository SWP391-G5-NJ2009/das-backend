const paymentDao = require("./payment.dao");
const AppError = require("../../utils/AppError");

async function getAllPayments() {
  const { data, error } = await paymentDao.findAllPayments();

  if (error) {
    throw new AppError(error.message, 500, "DB_ERROR");
  }

  return (data || []).map((payment) => ({
    payment_id: payment.payment_id,
    invoice_id: payment.invoice_id,
    amount: payment.amount,
    payment_method: payment.payment_method,
    payment_date: payment.payment_date,
    transaction_code: payment.transaction_code,
    status: payment.status,
  }));
}

module.exports = { getAllPayments };
