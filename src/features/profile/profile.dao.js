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

async function checkProfileExists(table, accountId) {
  const { data, error } = await supabase
    .from(table)
    .select("account_id")
    .eq("account_id", accountId)
    .maybeSingle();

  if (error) throw error;
  return data !== null;
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
  checkProfileExists,
  findAccountById,
  findProfileByAccountId,
  updateAccount,
  updateProfile,
};
