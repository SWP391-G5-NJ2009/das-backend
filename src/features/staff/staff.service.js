const staffDao = require("./staff.dao");
const AppError = require("../../utils/AppError");

function normalizeRoleName(account) {
    return account.role?.role_name?.toLowerCase() || ""; 
}

function mapStaffAccount(account, dentistMap, receptionistMap) {
    const role = normalizeRoleName(account);
    const profile = 
        role === "dentist"
            ? dentistMap.get(account.account_id)
            : receptionistMap.get(account.account_id);
    return {
        accountId: account.account_id,
        username: account.username || "",
        profileId: 
            role === "dentist"
                ? profile?.dentist_id || null
                : profile?.receptionist_id || null,
        fullName: profile?.full_name || account.username || "Not updated",
        email: profile?.email || account.email || "",
        phone: profile?.phone || account.phone || "",
        birthDate: profile?.birth_date || "",
        gender: profile?.gender || "",
        address: profile?.address || "",
        role: role,
        position: role === "dentist" ? profile?.speciality || "Dentist" : "Receptionist",
        speciality: profile?.speciality || "",
        experience: profile?.experience || "",
        status: account.status || "Inactive",
        createdDate: account.created_date,
    }
}

async function getAvailableDentistAccounts() {
  const { data: accounts, error: accountError } =
    await staffDao.findDentistAccounts();
  if (accountError) {
    throw new AppError(accountError.message, 500, "DB_ERROR");
  }

  const dentistAccounts = accounts || [];
  if (!dentistAccounts.length) return [];

  const accountIds = dentistAccounts.map((account) => account.account_id);
  const { data: profiles, error: profileError } =
    await staffDao.findDentistByAccountIds(accountIds);
  if (profileError) {
    throw new AppError(profileError.message, 500, "DB_ERROR");
  }

  const linkedAccountIds = new Set(
    (profiles || []).map((profile) => profile.account_id),
  );

  return dentistAccounts
    .filter((account) => !linkedAccountIds.has(account.account_id))
    .map((account) => ({
      accountId: account.account_id,
      username: account.username || "",
      email: account.email || "",
      phone: account.phone || "",
      role: normalizeRoleName(account),
      status: account.status || "Inactive",
    }));
}

async function createDentistProfile(payload) {
  const { data: availableAccounts, error: accountError } =
    await staffDao.findDentistAccounts();
  if (accountError) {
    throw new AppError(accountError.message, 500, "DB_ERROR");
  }
  const account = (availableAccounts || []).find(
    (item) => item.account_id === payload.accountId,
  );

  if (!account || normalizeRoleName(account) !== "dentist") {
    throw new AppError(
      "Không tìm thấy tài khoản nha sĩ đã chọn.",
      404,
      "DENTIST_ACCOUNT_NOT_FOUND",
    );
  }
  if (!account.email || !account.phone) {
    throw new AppError(
      "The selected account must have an email address and phone number.",
      400,
      "ACCOUNT_CONTACT_REQUIRED",
    );
  }

  const { data: existingProfile, error: existingError } =
    await staffDao.findDentistProfileByAccountId(payload.accountId);
  if (existingError) {
    throw new AppError(existingError.message, 500, "DB_ERROR");
  }
  if (existingProfile) {
    throw new AppError(
      "The selected Dentist account is already linked to a profile.",
      409,
      "DENTIST_PROFILE_EXISTS",
    );
  }

  const { data, error } = await staffDao.createDentistProfile({
    account_id: payload.accountId,
    full_name: payload.fullName,
    email: account.email,
    phone: account.phone,
    birth_date: payload.birthDate,
    gender: payload.gender,
    address: payload.address,
    speciality: payload.speciality,
    experience: payload.experience,
  });

  if (error) {
    if (error.code === "23505") {
      throw new AppError(
        "The selected Dentist account is already linked to a profile.",
        409,
        "DENTIST_PROFILE_EXISTS",
      );
    }
    throw new AppError(error.message, 500, "DB_ERROR");
  }

  return {
    profileId: data.dentist_id,
    accountId: data.account_id,
    fullName: data.full_name,
    email: data.email,
    phone: data.phone,
    birthDate: data.birth_date,
    gender: data.gender,
    address: data.address,
    speciality: data.speciality,
    experience: data.experience,
  };
}

async function getAllStaff({ search, role, status } = {}) {
  const { data: accounts, error } = await staffDao.findStaffAccounts();
  if (error) {
    throw new AppError(error.message, 500, "DB_ERROR");
  }

  const staffAccounts = accounts || [];
  const accountIds = staffAccounts.map((account) => account.account_id);

  if (!accountIds.length) {
    return [];
  }

  const [dentistResult, receptionistResult] = await Promise.all([
    staffDao.findDentistByAccountIds(accountIds),
    staffDao.findRepceptionistByAccountIds(accountIds),
  ])

  if (dentistResult.error) {
    throw new AppError(dentistResult.error.message, 500, "DB_ERROR");
  }

  if (receptionistResult.error) {
    throw new AppError(receptionistResult.error.message, 500, "DB_ERROR");
  }

  const dentistMap = new Map(
    (dentistResult.data || []).map((dentist) => [
        dentist.account_id,
        dentist
    ])
  )

  const receptionistMap = new Map(
    (receptionistResult.data || []).map((receptionist) => [
        receptionist.account_id,
        receptionist
    ])
  )

  let staff = staffAccounts.map((account) => 
    mapStaffAccount(account, dentistMap, receptionistMap),
  )

  if(role && role != "all") {
    staff = staff.filter((item) => item.role === role.toLowerCase());
  }

  if (status && status !== "all") {
    staff = staff.filter(
      (item) => item.status.toLowerCase() === status.toLowerCase(),
    );
  }

  if(search) {
    const keyword = search.trim().toLowerCase();
    staff = staff.filter((item) => item.fullName.toLowerCase().includes(keyword));
  }
  
  return staff;
}

module.exports = {
  createDentistProfile,
  getAvailableDentistAccounts,
  getAllStaff,
}
