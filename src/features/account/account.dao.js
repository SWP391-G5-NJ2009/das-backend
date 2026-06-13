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

async function findAllAccounts() {
  ensureSupabase();

  return supabase
    .from("account")
    .select("account_id, username, email, phone, status, created_date, role(role_name)")
    .order("created_date", { ascending: false });
}

async function findAccountByUsername(username) {
  ensureSupabase();

  return supabase
    .from("account")
    .select("account_id")
    .eq("username", username)
    .maybeSingle();
}

async function findAccountByUsernameExcept(username, accountId) {
  ensureSupabase();

  return supabase
    .from("account")
    .select("account_id")
    .eq("username", username)
    .neq("account_id", accountId)
    .maybeSingle();
}

async function findAccountById(accountId) {
  ensureSupabase();

  return supabase
    .from("account")
    .select("account_id")
    .eq("account_id", accountId)
    .single();
}

async function findRoleByName(roleName) {
  ensureSupabase();

  return supabase
    .from("role")
    .select("role_id")
    .ilike("role_name", roleName)
    .single();
}

async function insertAccount(account) {
  ensureSupabase();

  return supabase
    .from("account")
    .insert(account)
    .select("account_id, email, username, status, created_date, role(role_name)")
    .single();
}

async function updateAccount(accountId, updateFields) {
  ensureSupabase();

  return supabase
    .from("account")
    .update(updateFields)
    .eq("account_id", accountId)
    .select("account_id, email, username, status, created_date, role(role_name)")
    .single();
}

async function deleteAccount(accountId) {
  ensureSupabase();

  return supabase.from("account").delete().eq("account_id", accountId);
}

module.exports = {
  deleteAccount,
  findAccountById,
  findAccountByUsername,
  findAccountByUsernameExcept,
  findAllAccounts,
  findRoleByName,
  insertAccount,
  updateAccount,
};
