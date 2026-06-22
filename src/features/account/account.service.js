const bcrypt = require("bcryptjs");
const accountDao = require("./account.dao");
const AppError = require("../../utils/AppError");

async function getAllAccounts() {
  const { data, error } = await accountDao.findAllAccounts();

  if (error) {
    throw new AppError(error.message, 500, "DB_ERROR");
  }

  return data || [];
}

async function createAccount({
  username,
  email,
  phone,
  password,
  role_name,
  status,
}) {
  const { data: existing } = await accountDao.findAccountByUsername(username);

  if (existing) {
    throw new AppError("Username already exists.", 409, "DUPLICATE_USERNAME");
  }

  const { data: role, error: roleError } =
    await accountDao.findRoleByName(role_name);

  if (roleError || !role) {
    throw new AppError(`Role '${role_name}' not found.`, 400, "INVALID_ROLE");
  }

  const password_hash = await bcrypt.hash(password, 10);
  const { data, error } = await accountDao.insertAccount({
    username,
    email,
    phone,
    password: password_hash,
    password_hash,
    role_id: role.role_id,
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
    const { data: existing } =
      await accountDao.findAccountByUsernameExcept(username, accountId);

    if (existing) {
      throw new AppError("Username already exists.", 409, "DUPLICATE_USERNAME");
    }

    updateFields.username = username;
  }

  if (password !== undefined) {
    updateFields.password = await bcrypt.hash(password, 10);
    updateFields.password_hash = updateFields.password;
  }

  if (role_name !== undefined) {
    const { data: role, error: roleError } =
      await accountDao.findRoleByName(role_name);

    if (roleError || !role) {
      throw new AppError(`Role '${role_name}' not found.`, 400, "INVALID_ROLE");
    }

    updateFields.role_id = role.role_id;
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
