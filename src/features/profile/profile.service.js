const profileDao = require("./profile.dao");
const AppError = require("../../utils/AppError");
const normalizeRole = require("../../utils/normalizeRole");

const ROLE_PROFILE = {
  dentist: {
    table: "dentist",
    id: "dentist_id",
    fields: {
      speciality: "speciality",
      experience: "experience",
      avatar: "avatar",
    },
  },
  owner: {
    table: "owner",
    id: "owner_id",
    fields: {
      fullName: "full_name",
      phone: "phone",
    },
  },
  patient: {
    table: "patient",
    id: "patient_id",
    fields: {
      fullName: "full_name",
      email: "email",
      phone: "phone",
      birthDate: "dob",
      gender: "gender",
      address: "address",
      medicalHistory: "medical_history",
      avatar: "avatar",
    },
  },
  receptionist: {
    table: "receptionist",
    id: "receptionist_id",
    fields: {
      fullName: "full_name",
      phone: "phone",
      citizenId: "citizen_id",
    },
  },
};

const ACCOUNT_FIELDS = {
  email: "email",
  phone: "phone",
};

function pickColumns(payload, fields) {
  return Object.fromEntries(
    Object.entries(fields)
      .filter(([key]) => payload[key] !== undefined)
      .map(([key, column]) => [column, payload[key] || null]),
  );
}

function normalizeProfile(role, account, profile) {
  const config = ROLE_PROFILE[role];

  return {
    accountId: account.account_id,
    profileId: config && profile ? profile[config.id] : null,
    role,
    username: account.username || "",
    email: profile?.email || account.email || "",
    phone: profile?.phone || account.phone || "",
    status: account.status || "",
    fullName: profile?.full_name || account.username || account.email || "",
    birthDate: profile?.dob || "",
    gender: profile?.gender || "",
    address: profile?.address || "",
    medicalHistory: profile?.medical_history || "",
    citizenId: profile?.citizen_id || "",
    speciality: profile?.speciality || "",
    experience: profile?.experience || "",
    avatar: profile?.avatar || null,
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
  const accountFields = pickColumns(payload, ACCOUNT_FIELDS);

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

  let profile = null;

  if (config) {
    const profileFields = pickColumns(payload, config.fields);

    if (Object.keys(profileFields).length) {
      const { data, error } = await profileDao.updateProfile(
        config.table,
        accountId,
        profileFields,
      );

      if (error) {
        throw new AppError(error.message, 500, "DB_ERROR");
      }

      profile = data;
    } else {
      profile = (await getProfileForAccount(account)).profile;
    }
  }

  if (!Object.keys(accountFields).length && !profile) {
    throw new AppError("No fields to update.", 400, "NO_UPDATES");
  }

  return normalizeProfile(role, account, profile);
}

module.exports = {
  getMyProfile,
  updateMyProfile,
};
