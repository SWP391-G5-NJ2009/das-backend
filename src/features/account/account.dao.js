const supabase = require("../../config/supabase");

async function findAllAccounts() {
  return supabase
    .from("account")
    .select("account_id, username, email, phone, status, created_date, role(role_name)")
    .order("created_date", { ascending: false });
}

async function findAccountByUsername(username) {
  return supabase
    .from("account")
    .select("account_id")
    .eq("username", username)
    .maybeSingle();
}

async function findAccountByUsernameExcept(username, accountId) {
  return supabase
    .from("account")
    .select("account_id")
    .eq("username", username)
    .neq("account_id", accountId)
    .maybeSingle();
}

async function findAccountById(accountId) {
  return supabase
    .from("account")
    .select("account_id")
    .eq("account_id", accountId)
    .single();
}

async function findRoleByName(roleName) {
  return supabase
    .from("role")
    .select("role_id")
    .ilike("role_name", roleName)
    .single();
}

async function insertAccount(account) {
  return supabase
    .from("account")
    .insert(account)
    .select("account_id, email, username, status, created_date, role(role_name)")
    .single();
}

async function updateAccount(accountId, updateFields) {
  return supabase
    .from("account")
    .update(updateFields)
    .eq("account_id", accountId)
    .select("account_id, email, username, status, created_date, role(role_name)")
    .single();
}

async function deleteAccount(accountId) {
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
