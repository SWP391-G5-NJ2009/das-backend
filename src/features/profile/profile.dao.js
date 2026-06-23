const supabase = require("../../config/supabase");

function accountSelect() {
  return "account_id, email, username, phone, status, role(role_name)";
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
    .select("*")
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
    .select("*")
    .single();
}

module.exports = {
  findAccountById,
  findProfileByAccountId,
  updateAccount,
  updateProfile,
};
