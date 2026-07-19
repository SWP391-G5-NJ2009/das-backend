const accountDao = require("./account.dao");
const logger = require("../../utils/logger");
const AppError = require("../../utils/AppError");
const { hashPassword } = require("../../utils/password");

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
    throw new AppError("Tên đăng nhập đã tồn tại.", 409, "DUPLICATE_USERNAME");
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

  const role_id = await getRoleId(role_name);
  const password_hash = await hashPassword(password);
  const { data, error } = await accountDao.insertAccount({
    username,
    email,
    phone,
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
    ...(email !== undefined ? { email } : {}),
    ...(phone !== undefined ? { phone } : {}),
    ...(status !== undefined ? { status } : {}),
  };

  if (username !== undefined) {
    await ensureUsernameAvailable(username, accountId);
    updateFields.username = username;
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
  const { data: existing } = await accountDao.findAccountById(accountId);

  if (!existing) {
    throw new AppError("Không tìm thấy tài khoản.", 404, "NOT_FOUND");
  }

  const { error } = await accountDao.deleteAccount(accountId);

  if (error) {
    logger.error("Failed to delete accounts", error);
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
