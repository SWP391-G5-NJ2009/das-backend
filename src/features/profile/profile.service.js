const profileDao = require("./profile.dao");
const AppError = require("../../utils/AppError");
const normalizeRole = require("../../utils/normalizeRole");

const ROLE_PROFILE = {
  admin: { table: "admin", id: "admin_id" },
  dentist: { table: "dentist", id: "dentist_id" },
  owner: { table: "owner", id: "owner_id" },
  patient: { table: "patient", id: "patient_id" },
  receptionist: { table: "receptionist", id: "receptionist_id" },
};

const PROFILE_FIELDS = {
  fullName: "full_name",
  email: "email",
  birthDate: "birth_date",
  gender: "gender",
  address: "address",
};

function pickColumns(payload, fields) {
  return Object.fromEntries(
    Object.entries(fields)
      .filter(([key]) => payload[key] !== undefined)
      .map(([key, column]) => [column, payload[key] || null]),
  );
}

function normalizeProfile(role, account, profile) {
  return {
    role,
    fullName: profile?.full_name || account.email || "",
    email: profile?.email || account.email || "",
    birthDate: profile?.birth_date || "",
    gender: profile?.gender || "",
    address: profile?.address || "",
  };
}

async function getAccount(accountId) {
  const { data, error } = await profileDao.findAccountById(accountId);

  if (error || !data) {
    throw new AppError("Account not found.", 404, "ACCOUNT_NOT_FOUND");
  }

  return data;
}

async function getProfileForAccount(account) {
  const role = normalizeRole(account.role?.role_name);
  const config = ROLE_PROFILE[role];

  if (!config) {
    return { profile: null, role };
  }

  const { data, error } = await profileDao.findProfileByAccountId(
    config.table,
    account.account_id,
  );

  if (error) {
    throw new AppError(error.message, 500, "DB_ERROR");
  }

  return { profile: data, role };
}

async function getMyProfile(accountId) {
  const account = await getAccount(accountId);
  const { profile, role } = await getProfileForAccount(account);

  return normalizeProfile(role, account, profile);
}

async function updateMyProfile(accountId, payload) {
  let account = await getAccount(accountId);
  const role = normalizeRole(account.role?.role_name);
  const config = ROLE_PROFILE[role];
  const accountFields = pickColumns(payload, { email: "email" });
  const profileFields = pickColumns(payload, PROFILE_FIELDS);

  if (!Object.keys(accountFields).length && !Object.keys(profileFields).length) {
    throw new AppError("No fields to update.", 400, "NO_UPDATES");
  }

  if (Object.keys(accountFields).length) {
    const { data, error } = await profileDao.updateAccount(
      accountId,
      accountFields,
    );

    if (error) {
      throw new AppError(error.message, 500, "DB_ERROR");
    }

    account = data;
  }

  if (!config) {
    return normalizeProfile(role, account, null);
  }

  const { data: profile, error } = await profileDao.updateProfile(
    config.table,
    accountId,
    profileFields,
  );

  if (error) {
    throw new AppError(error.message, 500, "DB_ERROR");
  }

  return normalizeProfile(role, account, profile);
}

module.exports = {
  getMyProfile,
  updateMyProfile,
};
