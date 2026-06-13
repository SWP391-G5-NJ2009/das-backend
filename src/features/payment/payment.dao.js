const supabase = require("../../config/supabase");
const AppError = require("../../utils/AppError");

function ensureSupabase() {
  if (!supabase) {
    throw new AppError(
      "Supabase is not configured.",
      500,
      "SUPABASE_NOT_CONFIGURED",
    );
  }
}

async function findAllPayments() {
  ensureSupabase();

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
