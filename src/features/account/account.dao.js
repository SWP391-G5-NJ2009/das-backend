const supabase = require("../../config/supabase");

async function findAllAccounts(filters = {}) {
  const PAGE_SIZE = 20;
  const page = parseInt(filters.pagination) || 1;

  let query = supabase
    .from("account")
    .select("*, role(role_name)", { count: "exact" })
    .order("created_date", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1);

  if (filters.roleId) {
    query = query.eq("role_id", filters.roleId);
  }

  if (filters.status && filters.status !== "All") {
    query = query.eq("status", filters.status);
  }

  if (filters.search) {
    const s = `%${filters.search}%`;
    query = query.or(`username.ilike.${s},phone.ilike.${s},email.ilike.${s}`);
  }

  if (filters.from_date) {
    const start = new Date(filters.from_date);
    query = query.gte("created_date", start.toISOString());
  }

  if (filters.to_date) {
    const end = new Date(filters.to_date);
    end.setDate(end.getDate() + 1);
    query = query.lt("created_date", end.toISOString());
  }

  return query;
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

async function findAccountByEmail(email) {
  return supabase
    .from("account")
    .select("account_id")
    .eq("email", email)
    .maybeSingle();
}

async function findAccountByEmailExcept(email, accountId) {
  return supabase
    .from("account")
    .select("account_id")
    .eq("email", email)
    .neq("account_id", accountId)
    .maybeSingle();
}

async function findAccountById(accountId) {
  return supabase
    .from("account")
    .select("account_id, role(role_name)")
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

async function deleteOtpTokensByAccountId(accountId) {
  return supabase.from("otp_tokens").delete().eq("account_id", accountId);
}

module.exports = {
  deleteAccount,
  deleteOtpTokensByAccountId,
  findAccountById,
  findAccountByUsername,
  findAccountByUsernameExcept,
  findAccountByEmail,
  findAccountByEmailExcept,
  findAllAccounts,
  findRoleByName,
  insertAccount,
  updateAccount,
};
