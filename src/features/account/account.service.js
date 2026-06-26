const accountDao = require("./account.dao");
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
    throw new AppError(error.message, 500, "DB_ERROR");
  }

  return { items: data || [], total: count || 0 };
}

async function ensureUsernameAvailable(username, accountId = null) {
  const lookup = accountId
    ? accountDao.findAccountByUsernameExcept(username, accountId)
    : accountDao.findAccountByUsername(username);
  const { data: existing } = await lookup;

  if (existing) {
    throw new AppError("Username already exists.", 409, "DUPLICATE_USERNAME");
  }
}

async function getRoleId(roleName) {
  const { data: role, error } = await accountDao.findRoleByName(roleName);

  if (error || !role) {
    throw new AppError(`Role '${roleName}' not found.`, 400, "INVALID_ROLE");
  }

  return role.role_id;
}

async function createAccount({
  username,
  email,
  phone,
  password,
  role_name,
  status,
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
    status: status || "Active",
  });

  if (error) {
    throw new AppError(error.message, 500, "DB_ERROR");
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
    throw new AppError("No fields to update.", 400, "NO_UPDATES");
  }

  const { data, error } = await accountDao.updateAccount(
    accountId,
    updateFields,
  );

  if (error) {
    throw new AppError(error.message, 500, "DB_ERROR");
  }

  return data;
}

async function deleteAccount(accountId) {
  const { data: existing } = await accountDao.findAccountById(accountId);

  if (!existing) {
    throw new AppError("Account not found.", 404, "NOT_FOUND");
  }

  const { error } = await accountDao.deleteAccount(accountId);

  if (error) {
    throw new AppError(error.message, 500, "DB_ERROR");
  }

  return { account_id: accountId };
}

module.exports = {
  createAccount,
  deleteAccount,
  getAllAccounts,
  updateAccount,
};
