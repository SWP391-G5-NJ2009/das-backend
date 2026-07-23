const authDao = require("./auth.dao");
const textbeeService = require("../../integrations/textbee/textbee.service");
const AppError = require("../../utils/AppError");
const { signJWT } = require("../../utils/jwt");
const logger = require("../../utils/logger");
const {
  compareOtp,
  generateOtp,
  getOtpExpiry,
  hashOtp,
} = require("../../utils/otp");
const { comparePassword, hashPassword } = require("../../utils/password");
const normalizeRole = require("../../utils/normalizeRole");

const ROLE_PROFILE_TABLE = {
  admin: { table: "admin", idColumn: "admin_id" },
  patient: { table: "patient", idColumn: "patient_id" },
  dentist: { table: "dentist", idColumn: "dentist_id" },
  receptionist: { table: "receptionist", idColumn: "receptionist_id" },
  manager: { table: "manager", idColumn: "manager_id" },
};

const STAFF_ROLES = ["receptionist", "dentist", "manager", "admin"];
const INVALID_CREDENTIALS_MESSAGE =
  "Thông tin đăng nhập không hợp lệ. Vui lòng thử lại.";
const PROCESSING_ERROR_MESSAGE =
  "Không thể xử lý dữ liệu. Vui lòng thử lại sau.";
const PASSWORD_UPDATE_ERROR_MESSAGE =
  "Không thể cập nhật mật khẩu. Vui lòng thử lại sau.";

function invalidCredentialsError() {
  return new AppError(INVALID_CREDENTIALS_MESSAGE, 401, "INVALID_CREDENTIALS");
}

function processingError() {
  return new AppError(PROCESSING_ERROR_MESSAGE, 500, "DB_ERROR");
}

function passwordUpdateError() {
  return new AppError(PASSWORD_UPDATE_ERROR_MESSAGE, 500, "DB_ERROR");
}

function isActiveStatus(status) {
  return String(status || "").toLowerCase() === "active";
}

function isDuplicateLookupError(error) {
  const errorMessage = `${error.message || ""} ${error.details || ""}`;
  return errorMessage.toLowerCase().includes("multiple");
}

async function verifyPassword(account, password) {
  return comparePassword(password, account.password_hash);
}

async function getAccountById(accountId) {
  const { data, error } = await authDao.findAccountById(accountId);

  if (error || !data) {
    throw new AppError("Không tìm thấy tài khoản.", 404, "ACCOUNT_NOT_FOUND");
  }

  return data;
}

async function getProfile(role, accountId) {
  const normalizedRole = normalizeRole(role);
  const profileConfig = ROLE_PROFILE_TABLE[normalizedRole];

  if (!profileConfig) {
    return null;
  }

  const { data, error } = await authDao.findProfile(
    profileConfig.table,
    accountId,
  );

  if (error) {
    throw processingError();
  }

  return data;
}

function createAuthPayload(account, profile) {
  const role = normalizeRole(account.role?.role_name);
  const profileConfig = ROLE_PROFILE_TABLE[role];
  const profileId =
    profileConfig && profile ? profile[profileConfig.idColumn] : null;

  return {
    accountId: account.account_id,
    email: account.email,
    username: account.username,
    role,
    profileId,
    fullName: profile?.full_name || account.email,
    phone: profile?.phone || null,
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
  const role = normalizeRole(account?.role?.role_name);

  if (!account || !allowedRoles.includes(role)) {
    throw invalidCredentialsError();
  }

  if (!isActiveStatus(account.status)) {
    const isRestricted =
      String(account.status || "").toLowerCase() === "restricted";
    throw new AppError(
      isRestricted
        ? "Tài khoản của bạn đã bị hạn chế tạm thời do nhiều lần không đến khám theo lịch hẹn. Vui lòng liên hệ với phòng khám để gỡ bỏ hạn chế này."
        : "Tài khoản chưa được kích hoạt",
      403,
      isRestricted ? "ACCOUNT_RESTRICTED" : "ACCOUNT_INACTIVE",
    );
  }

  const passwordMatches = await verifyPassword(account, password);
  if (!passwordMatches) {
    throw invalidCredentialsError();
  }

  return issueAuth(account);
}

async function patientLogin({ phone, password }) {
  const { data: patient, error } = await authDao.findPatientByPhone(phone);

  if (error || !patient?.account) {
    throw new AppError(
      "Không tìm thấy số điện thoại. Vui lòng kiểm tra và thử lại.",
      404,
      "PHONE_NOT_FOUND",
    );
  }

  return loginWithAccount(patient.account, password, ["patient"]);
}

async function staffLogin({ username, password }) {
  const { data: account, error } =
    await authDao.findStaffAccountByIdentifier(username);

  if (error || !account) {
    throw invalidCredentialsError();
  }

  return loginWithAccount(account, password, STAFF_ROLES);
}

async function findAccountForIdentifier(identifier) {
  const { data: patient, error: patientError } =
    await authDao.findPatientAccountByPhone(identifier);

  if (patientError) {
    throw processingError();
  }

  if (patient?.account) {
    return { account: patient.account, phone: patient.phone };
  }

  const { data: account, error: accountError } =
    await authDao.findAccountByIdentifier(identifier);

  if (accountError) {
    throw processingError();
  }

  if (!account) {
    throw new AppError(
      "Không tìm thấy số điện thoại. Hãy thử lại.",
      404,
      "ACCOUNT_NOT_FOUND",
    );
  }

  return { account, phone: null };
}

async function createPasswordResetOtp({ account, recipient }) {
  if (!recipient) {
    throw new AppError(
      "This account does not have a phone number for OTP delivery.",
      400,
      "OTP_PHONE_NOT_FOUND",
    );
  }

  const otp = generateOtp();
  const otpHash = await hashOtp(otp);

  const { error } = await authDao.insertOtpToken({
    account_id: account.account_id,
    phone: recipient,
    purpose: "reset_password",
    otp_hash: otpHash,
    expires_at: getOtpExpiry(),
  });

  if (error) {
    throw processingError();
  }

  let otpDelivery = "textbee";
  let smsResult = null;

  try {
    smsResult = await textbeeService.sendSms({
      recipient,
      message: textbeeService.resetPasswordOtp({ otp }),
    });
  } catch (smsError) {
    otpDelivery = "textbee_failed";
    logger.error("TextBee OTP delivery failed.", {
      accountId: account.account_id,
      error: smsError.message,
      code: smsError.code,
    });

    if (process.env.NODE_ENV === "production") {
      throw new AppError(
        "Hiện không thể gửi OTP. Vui lòng thử lại sau.",
        502,
        "OTP_DELIVERY_FAILED",
      );
    }
  }

  return {
    accountId: account.account_id,
    otpDelivery,
    smsMessageId: smsResult?.messageId || smsResult?.id || null,
    devOtp: process.env.NODE_ENV === "production" ? undefined : otp,
  };
}

async function forgotPassword({ identifier }) {
  const { account, phone } = await findAccountForIdentifier(identifier);
  const profile = await getProfile(account.role?.role_name, account.account_id);
  const recipient = phone || account.phone || profile?.phone;

  return createPasswordResetOtp({ account, recipient });
}

async function staffForgotPassword({ username }) {
  const normalizedUsername = username.trim().toLowerCase();
  const { data: account, error } =
    await authDao.findStaffAccountByUsername(normalizedUsername);

  if (error) {
    const isDuplicateLookup = isDuplicateLookupError(error);

    throw new AppError(
      isDuplicateLookup
        ? "Staff username lookup is not unique. Please contact an administrator."
        : PROCESSING_ERROR_MESSAGE,
      500,
      isDuplicateLookup ? "USERNAME_NOT_UNIQUE" : "DB_ERROR",
    );
  }

  const role = normalizeRole(account?.role?.role_name);
  if (
    !account ||
    !STAFF_ROLES.includes(role) ||
    String(account.username || "").toLowerCase() !== normalizedUsername
  ) {
    throw new AppError(
      "Không tìm thấy tài khoản. Hãy thử lại.",
      404,
      "ACCOUNT_NOT_FOUND",
    );
  }

  return createPasswordResetOtp({
    account,
    recipient: account.phone,
  });
}

async function getLatestValidOtp({ accountId, identifier, otp }) {
  const account = accountId
    ? await getAccountById(accountId)
    : (await findAccountForIdentifier(identifier)).account;
  const { data, error } = await authDao.findLatestResetPasswordOtp(
    account.account_id,
  );

  if (error) {
    throw new AppError(error.message, 500, "DB_ERROR");
  }

  if (!data || !(await compareOtp(otp, data.otp_hash))) {
    throw new AppError(
      "OTP không hợp lệ. Vui lòng thử lại.",
      400,
      "OTP_INVALID",
    );
  }

  return { account, otpToken: data };
}

async function verifyOtp({ accountId, identifier, otp }) {
  await getLatestValidOtp({ accountId, identifier, otp });
  return { verified: true };
}

async function resetPassword({ accountId, identifier, otp, newPassword }) {
  const { account, otpToken } = await getLatestValidOtp({
    accountId,
    identifier,
    otp,
  });
  const passwordHash = await hashPassword(newPassword);

  const { error: updateError } = await authDao.updateAccountPassword(
    account.account_id,
    passwordHash,
  );

  if (updateError) {
    throw passwordUpdateError();
  }

  const { error: consumeError } = await authDao.consumeOtpToken(
    otpToken.otp_id,
  );

  if (consumeError) {
    throw new AppError(
      "Không thể hoàn tất đặt lại mật khẩu. Vui lòng thử lại sau.",
      500,
      "DB_ERROR",
    );
  }

  return { reset: true };
}

async function changePassword({ accountId, oldPassword, newPassword }) {
  const account = await getAccountById(accountId);
  const passwordMatches = await verifyPassword(account, oldPassword);

  if (!passwordMatches) {
    throw new AppError(
      "Mật khẩu hiện tại không đúng. Vui lòng thử lại.",
      401,
      "INVALID_PASSWORD",
    );
  }

  const passwordHash = await hashPassword(newPassword);
  const { error } = await authDao.updateAccountPassword(
    accountId,
    passwordHash,
  );

  if (error) {
    throw passwordUpdateError();
  }

  return { changed: true };
}

module.exports = {
  changePassword,
  forgotPassword,
  patientLogin,
  resetPassword,
  staffLogin,
  staffForgotPassword,
  verifyOtp,
};
