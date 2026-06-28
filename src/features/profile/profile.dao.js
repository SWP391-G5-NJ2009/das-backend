const supabase = require("../../config/supabase");

function accountSelect() {
  return "account_id, email, role(role_name)";
}

function profileSelect() {
  return "full_name, email, birth_date, gender, address";
}

async function findAccountById(accountId) {
  return supabase
    .from("account")
    .select(accountSelect())
    .eq("account_id", accountId)
    .single();
}

async function findProfileByAccountId(table, accountId) {
  return supabase
    .from(table)
    .select(profileSelect())
    .eq("account_id", accountId)
    .maybeSingle();
}

async function updateAccount(accountId, payload) {
  return supabase
    .from("account")
    .update(payload)
    .eq("account_id", accountId)
    .select(accountSelect())
    .single();
}

async function updateProfile(table, accountId, payload) {
  return supabase
    .from(table)
    .update(payload)
    .eq("account_id", accountId)
    .select(profileSelect())
    .single();
}

module.exports = {
  findAccountById,
  findProfileByAccountId,
  updateAccount,
  updateProfile,
};
