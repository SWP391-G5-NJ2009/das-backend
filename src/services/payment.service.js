
const supabase = require("../config/supabase");
const AppError = require("../utils/AppError");

async function getAllPayments() {
  const { data, error } = await supabase
    .from("payment")
    .select(`
      payment_id,
      invoice_id,
      amount,
      payment_method,
      payment_date,
      transaction_code,
      status
    `)
    .order("payment_date", { ascending: false });

  if (error) {
    throw new AppError(error.message, 500, "DB_ERROR");
  }

  return data.map((payment) => ({
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
