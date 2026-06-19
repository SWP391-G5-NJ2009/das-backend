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
  return "account_id, email, username, phone, password, password_hash, role_id, status, role(role_name)";
}

async function findAccountById(accountId) {
  ensureSupabase();

  return supabase
    .from("account")
    .select(accountSelect())
    .eq("account_id", accountId)
    .single();
}

async function findProfile(table, accountId) {
  ensureSupabase();

  return supabase
    .from(table)
    .select("*")
    .eq("account_id", accountId)
    .maybeSingle();
}

async function findPatientByPhone(phone) {
  ensureSupabase();

  return supabase
    .from("patient")
    .select(`patient_id, account_id, account(${accountSelect()})`)
    .eq("phone", phone)
    .single();
}

async function findPatientAccountByPhone(phone) {
  ensureSupabase();

  return supabase
    .from("patient")
    .select(`phone, account(${accountSelect()})`)
    .eq("phone", phone)
    .maybeSingle();
}

async function findStaffAccountByIdentifier(identifier) {
  ensureSupabase();

  return supabase
    .from("account")
    .select(accountSelect())
    .or(`username.eq.${identifier},email.eq.${identifier}`)
    .single();
}

async function findStaffAccountByUsername(username) {
  ensureSupabase();

  return supabase
    .from("account")
    .select(accountSelect())
    .ilike("username", username)
    .maybeSingle();
}

async function findAccountByIdentifier(identifier) {
  ensureSupabase();

  return supabase
    .from("account")
    .select(accountSelect())
    .or(`username.eq.${identifier},email.eq.${identifier}`)
    .maybeSingle();
}

async function insertOtpToken(payload) {
  ensureSupabase();

  return supabase.from("otp_tokens").insert(payload);
}

async function findLatestResetPasswordOtp(accountId) {
  ensureSupabase();

  return supabase
    .from("otp_tokens")
    .select("*")
    .eq("account_id", accountId)
    .eq("purpose", "reset_password")
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
}

async function updateAccountPassword(accountId, passwordHash) {
  ensureSupabase();

  return supabase
    .from("account")
    .update({ password_hash: passwordHash, password: passwordHash })
    .eq("account_id", accountId);
}

async function consumeOtpToken(otpId) {
  ensureSupabase();

  return supabase
    .from("otp_tokens")
    .update({ consumed_at: new Date().toISOString() })
    .eq("otp_id", otpId);
}

module.exports = {
  consumeOtpToken,
  findAccountById,
  findAccountByIdentifier,
  findLatestResetPasswordOtp,
  findPatientAccountByPhone,
  findPatientByPhone,
  findProfile,
  findStaffAccountByUsername,
  findStaffAccountByIdentifier,
  insertOtpToken,
  updateAccountPassword,
};
