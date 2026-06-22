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

function accountSelect() {
  return "account_id, email, username, phone, status, role(role_name)";
}

async function findAccountById(accountId) {
  ensureSupabase();

  return supabase
    .from("account")
    .select(accountSelect())
    .eq("account_id", accountId)
    .single();
}

async function findProfileByAccountId(table, accountId) {
  ensureSupabase();

  return supabase
    .from(table)
    .select("*")
    .eq("account_id", accountId)
    .maybeSingle();
}

async function updateAccount(accountId, payload) {
  ensureSupabase();

  return supabase
    .from("account")
    .update(payload)
    .eq("account_id", accountId)
    .select(accountSelect())
    .single();
}

async function updateProfile(table, accountId, payload) {
  ensureSupabase();

  return supabase
    .from(table)
    .update(payload)
    .eq("account_id", accountId)
    .select("*")
    .single();
}

module.exports = {
  findAccountById,
  findProfileByAccountId,
  updateAccount,
  updateProfile,
};
