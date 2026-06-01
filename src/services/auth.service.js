const bcrypt = require("bcryptjs");
const supabase = require("../config/supabase");
const AppError = require("../utils/AppError");
const { signJWT } = require("../utils/jwt");
const { compareOtp, generateOtp, getOtpExpiry, hashOtp } = require("../utils/otp");

const ROLE_PROFILE_TABLE = {
  patient: { table: "patient", idColumn: "patient_id" },
  dentist: { table: "dentist", idColumn: "dentist_id" },
  receptionist: { table: "receptionist", idColumn: "receptionist_id" },
  owner: { table: "owner", idColumn: "owner_id" },
};

function ensureSupabase() {
  if (!supabase) {
    throw new AppError("Supabase is not configured.", 500, "SUPABASE_NOT_CONFIGURED");
  }
}

function normalizeRole(roleName) {
  return String(roleName || "").toLowerCase();
}

function isBcryptHash(value) {
  return /^\$2[aby]\$/.test(String(value || ""));
}

async function verifyPassword(account, password) {
  const storedPassword = account.password_hash || account.password;

  if (!storedPassword) {
    return false;
  }

  if (isBcryptHash(storedPassword)) {
    return bcrypt.compare(password, storedPassword);
  }

  return storedPassword === password;
}

async function getAccountById(accountId) {
  ensureSupabase();

  const { data, error } = await supabase
    .from("account")
    .select("account_id, email, username, password, password_hash, role_id, status, role(role_name)")
    .eq("account_id", accountId)
    .single();

  if (error || !data) {
    throw new AppError("Account not found.", 404, "ACCOUNT_NOT_FOUND");
  }

  return data;
}

async function getProfile(role, accountId) {
  const normalizedRole = normalizeRole(role);
  const profileConfig = ROLE_PROFILE_TABLE[normalizedRole];

  if (!profileConfig) {
    return null;
  }

  const { data, error } = await supabase
    .from(profileConfig.table)
    .select("*")
    .eq("account_id", accountId)
    .maybeSingle();

  if (error) {
    throw new AppError(error.message, 500, "DB_ERROR");
  }

  return data;
}

function createAuthPayload(account, profile) {
  const role = normalizeRole(account.role?.role_name);
  const profileConfig = ROLE_PROFILE_TABLE[role];
  const profileId = profileConfig && profile ? profile[profileConfig.idColumn] : null;
  const fullName = profile?.full_name || account.email;

  return {
    accountId: account.account_id,
    email: account.email,
    username: account.username,
    role,
    profileId,
    fullName,
  };
}

async function issueAuth(account) {
  const profile = await getProfile(account.role?.role_name, account.account_id);
  const user = createAuthPayload(account, profile);
  const token = signJWT({
    id: user.accountId,
    role: user.role,
    profileId: user.profileId,
  });

  return { user, token };
}

async function loginWithAccount(account, password, allowedRoles) {
  const role = normalizeRole(account.role?.role_name);

  if (!account || !allowedRoles.includes(role)) {
    throw new AppError("Incorrect credentials. Please try again.", 401, "INVALID_CREDENTIALS");
  }

  if (String(account.status || "").toLowerCase() !== "active") {
    throw new AppError("Account is not active.", 403, "ACCOUNT_INACTIVE");
  }

  const passwordMatches = await verifyPassword(account, password);
  if (!passwordMatches) {
    throw new AppError("Incorrect credentials. Please try again.", 401, "INVALID_CREDENTIALS");
  }

  return issueAuth(account);
}

async function patientLogin({ phone, password }) {
  ensureSupabase();

  const { data: patient, error } = await supabase
    .from("patient")
    .select("patient_id, account_id, account(account_id, email, username, password, password_hash, role_id, status, role(role_name))")
    .eq("phone", phone)
    .single();

  if (error || !patient?.account) {
    throw new AppError("Phone number not found. Please check and try again.", 404, "PHONE_NOT_FOUND");
  }

  return loginWithAccount(patient.account, password, ["patient"]);
}

async function staffLogin({ username, password }) {
  ensureSupabase();

  const { data: account, error } = await supabase
    .from("account")
    .select("account_id, email, username, password, password_hash, role_id, status, role(role_name)")
    .or(`username.eq.${username},email.eq.${username}`)
    .single();

  if (error || !account) {
    throw new AppError("Incorrect credentials. Please try again.", 401, "INVALID_CREDENTIALS");
  }

  return loginWithAccount(account, password, ["receptionist", "dentist", "owner", "admin"]);
}

async function findAccountForIdentifier(identifier) {
  const { data: patient, error: patientError } = await supabase
    .from("patient")
    .select("phone, account(account_id, email, username, password, password_hash, role_id, status, role(role_name))")
    .eq("phone", identifier)
    .maybeSingle();

  if (patientError) {
    throw new AppError(patientError.message, 500, "DB_ERROR");
  }

  if (patient?.account) {
    return { account: patient.account, phone: patient.phone };
  }

  const { data: account, error: accountError } = await supabase
    .from("account")
    .select("account_id, email, username, password, password_hash, role_id, status, role(role_name)")
    .or(`username.eq.${identifier},email.eq.${identifier}`)
    .maybeSingle();

  if (accountError) {
    throw new AppError(accountError.message, 500, "DB_ERROR");
  }

  if (!account) {
    throw new AppError("Account not found. Please check and try again.", 404, "ACCOUNT_NOT_FOUND");
  }

  return { account, phone: null };
}

async function forgotPassword({ identifier }) {
  ensureSupabase();

  const { account, phone } = await findAccountForIdentifier(identifier);
  const otp = generateOtp();
  const otpHash = await hashOtp(otp);

  const { error } = await supabase.from("otp_tokens").insert({
    account_id: account.account_id,
    phone,
    purpose: "reset_password",
    otp_hash: otpHash,
    expires_at: getOtpExpiry(),
  });

  if (error) {
    throw new AppError(error.message, 500, "DB_ERROR");
  }

  return {
    otpDelivery: "development_stub",
    devOtp: process.env.NODE_ENV === "production" ? undefined : otp,
  };
}

async function getLatestValidOtp(identifier, otp) {
  const { account } = await findAccountForIdentifier(identifier);
  const { data, error } = await supabase
    .from("otp_tokens")
    .select("*")
    .eq("account_id", account.account_id)
    .eq("purpose", "reset_password")
    .is("consumed_at", null)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new AppError(error.message, 500, "DB_ERROR");
  }

  if (!data || !(await compareOtp(otp, data.otp_hash))) {
    throw new AppError("Invalid OTP. Please try again.", 400, "OTP_INVALID");
  }

  return { account, otpToken: data };
}

async function verifyOtp({ identifier, otp }) {
  ensureSupabase();
  await getLatestValidOtp(identifier, otp);
  return { verified: true };
}

async function resetPassword({ identifier, otp, newPassword }) {
  ensureSupabase();

  const { account, otpToken } = await getLatestValidOtp(identifier, otp);
  const passwordHash = await bcrypt.hash(newPassword, 10);

  const { error: updateError } = await supabase
    .from("account")
    .update({ password_hash: passwordHash, password: passwordHash })
    .eq("account_id", account.account_id);

  if (updateError) {
    throw new AppError(updateError.message, 500, "DB_ERROR");
  }

  const { error: consumeError } = await supabase
    .from("otp_tokens")
    .update({ consumed_at: new Date().toISOString() })
    .eq("otp_id", otpToken.otp_id);

  if (consumeError) {
    throw new AppError(consumeError.message, 500, "DB_ERROR");
  }

  return { reset: true };
}

async function changePassword({ accountId, oldPassword, newPassword }) {
  ensureSupabase();

  const account = await getAccountById(accountId);
  const passwordMatches = await verifyPassword(account, oldPassword);

  if (!passwordMatches) {
    throw new AppError("Incorrect password. Please try again.", 401, "INVALID_PASSWORD");
  }

  const passwordHash = await bcrypt.hash(newPassword, 10);
  const { error } = await supabase
    .from("account")
    .update({ password_hash: passwordHash, password: passwordHash })
    .eq("account_id", accountId);

  if (error) {
    throw new AppError(error.message, 500, "DB_ERROR");
  }

  return { changed: true };
}

module.exports = {
  changePassword,
  forgotPassword,
  patientLogin,
  resetPassword,
  staffLogin,
  verifyOtp,
};
