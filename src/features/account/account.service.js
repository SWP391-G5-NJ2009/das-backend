const accountDao = require("./account.dao");
const logger = require("../../utils/logger");
const AppError = require("../../utils/AppError");
const { hashPassword } = require("../../utils/password");
const profileDao = require("../profile/profile.dao");

async function getAllAccounts(filters = {}) {
  let queryFilters = { ...filters };

  if (queryFilters.status && queryFilters.status !== "All") {
    const roleId = await getRoleId(queryFilters.status);
    queryFilters.roleId = roleId;
  }

  const { data, error, count } = await accountDao.findAllAccounts(queryFilters);

  if (error) {
    logger.error("Failed to retrieve accounts", error);
    throw new AppError("Đã xảy ra lỗi. Vui lòng thử lại sau.", 500, "DB_ERROR");
  }

  return { items: data || [], total: count || 0 };
}

async function ensureUsernameAvailable(username, accountId = null) {
  const lookup = accountId
    ? accountDao.findAccountByUsernameExcept(username, accountId)
    : accountDao.findAccountByUsername(username);
  const { data, error } = await lookup;

  if (error) {
    logger.error("Failed to check username availability", error);
    throw new AppError("Đã xảy ra lỗi. Vui lòng thử lại sau.", 500, "DB_ERROR");
  }

  if (data) {
    throw new AppError("Tên đăng nhập đã được sử dụng.", 409, "DUPLICATE_USERNAME");
  }
}

async function ensureEmailAvailable(email, accountId = null) {
  const lookup = accountId
    ? accountDao.findAccountByEmailExcept(email, accountId)
    : accountDao.findAccountByEmail(email);
  const { data, error } = await lookup;

  if (error) {
    logger.error("Failed to check email availability", error);
    throw new AppError("Đã xảy ra lỗi. Vui lòng thử lại sau.", 500, "DB_ERROR");
  }

  if (data) {
    throw new AppError("Email đã được sử dụng.", 409, "DUPLICATE_EMAIL");
  }
}

async function getRoleId(roleName) {
  const { data: role, error } = await accountDao.findRoleByName(roleName);

  if (error) {
    logger.error("Failed to retrieve role name", error);
    throw new AppError("Đã xảy ra lỗi. Vui lòng thử lại sau.", 500, "DB_ERROR");
  }

  if (!role) {
    logger.error(`Role '${roleName}' not found`);
    throw new AppError("Đã xảy ra lỗi khi tìm vai trò", 400, "INVALID_ROLE");
  }

  return role.role_id;
}

async function createAccount({
  username,
  email,
  phone,
  password,
  role_name,
}) {
  await ensureUsernameAvailable(username);
  if (email) {
    await ensureEmailAvailable(email);
  }

  const role_id = await getRoleId(role_name);
  const password_hash = await hashPassword(password);
  const { data, error } = await accountDao.insertAccount({
    username,
    email: email || null,
    phone: phone || null,
    password_hash,
    role_id,
    status: "Active",
  });

  if (error) {
    logger.error("Failed to insert account", error);
    throw new AppError("Đã xảy ra lỗi. Vui lòng thử lại sau.", 500, "DB_ERROR");
  }

  return data;
}

async function updateAccount(
  accountId,
  { username, email, phone, password, role_name, status },
) {

  const updateFields = {
    ...(status !== undefined ? { status } : {}),
  };

  if (username !== undefined) {
    await ensureUsernameAvailable(username, accountId);
    updateFields.username = username;
  }

  if (email !== undefined && email !== "") {
    await ensureEmailAvailable(email, accountId);
    updateFields.email = email;
  } else {
    updateFields.email = null;
  }

  if (phone !== undefined && phone !== "") {
    updateFields.phone = phone;
  } else {
    updateFields.phone = null;
  }

  if (password !== undefined) {
    updateFields.password_hash = await hashPassword(password);
  }

  if (role_name !== undefined) {
    updateFields.role_id = await getRoleId(role_name);
  }

  if (Object.keys(updateFields).length === 0) {
    throw new AppError("Không có trường nào để cập nhật.", 400, "NO_UPDATES");
  }

  const { data, error } = await accountDao.updateAccount(
    accountId,
    updateFields,
  );

  if (error) {
    logger.error("Failed to update account", error);
    throw new AppError("Đã xảy ra lỗi. Vui lòng thử lại sau.", 500, "DB_ERROR");
  }

  return data;
}

async function deleteAccount(accountId) {
  const { data, error: findAccountError } = await accountDao.findAccountById(accountId);

  if (findAccountError) {
    logger.error("Failed to find account to delete", findAccountError);
    throw new AppError("Đã xảy ra lỗi. Vui lòng thử lại sau.", 500, "DB_ERROR");
  }

  if (!data) {
    throw new AppError("Không tìm thấy tài khoản.", 404, "NOT_FOUND");
  }

  const ROLE_TABLE_MAP = {
    Receptionist: "receptionist",
    Dentist: "dentist",
    Patient: "patient",
  };

  const ROLE_DISPLAY_NAME = {
    Receptionist: "lễ tân",
    Dentist: "nha sĩ",
    Patient: "bệnh nhân",
  };

  const table = ROLE_TABLE_MAP[data.role.role_name];
  if (table) {
    const hasProfile = await profileDao.checkProfileExists(table, accountId);
    if (hasProfile) {
      throw new AppError(
        `Đang có hồ sơ ${ROLE_DISPLAY_NAME[data.role.role_name]} liên kết tới tài khoản này.`,
        409,
        "ACCOUNT_HAS_LINKED_PROFILE",
      );
    }
  }

  await accountDao.deleteOtpTokensByAccountId(accountId);

  const { error: deleteError } = await accountDao.deleteAccount(accountId);

  if (deleteError) {
    logger.error("Failed to delete account", deleteError);
    throw new AppError("Đã xảy ra lỗi. Vui lòng thử lại sau.", 500, "DB_ERROR");
  }

  return { account_id: accountId };
}

module.exports = {
  createAccount,
  deleteAccount,
  getAllAccounts,
  updateAccount,
};
