const supabase = require("../../config/supabase");

async function findAllPayments() {
  return supabase
    .from("payment")
    .select(
      `
      payment_id,
      invoice_id,
      amount,
      payment_method,
      payment_date,
      transaction_code,
      status
    `,
    )
    .order("payment_date", { ascending: false });
}

module.exports = { findAllPayments };
