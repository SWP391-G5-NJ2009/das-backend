const staffDao = require("./staff.dao");
const AppError = require("../../utils/AppError");

function normalizeRoleName(account) {
  return account.role?.role_name?.toLowerCase() || "";
}

function mapStaffAccount(
  account,
  dentistMap,
  receptionistMap,
  dentistServicesMap,
) {
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
    services:
      role === "dentist"
        ? dentistServicesMap.get(profile?.dentist_id) || []
        : [],
    status: account.status || "Inactive",
    createdDate: account.created_date,
  };
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
  ]);

  if (dentistResult.error) {
    throw new AppError(dentistResult.error.message, 500, "DB_ERROR");
  }

  if (receptionistResult.error) {
    throw new AppError(receptionistResult.error.message, 500, "DB_ERROR");
  }

  const dentistIds = (dentistResult.data || []).map(
    (dentist) => dentist.dentist_id,
  );
  const dentistServicesResult =
    await staffDao.findDentistServicesByDentistIds(dentistIds);

  if (dentistServicesResult.error) {
    throw new AppError(dentistServicesResult.error.message, 500, "DB_ERROR");
  }

  const dentistMap = new Map(
    (dentistResult.data || []).map((dentist) => [dentist.account_id, dentist]),
  );

  const receptionistMap = new Map(
    (receptionistResult.data || []).map((receptionist) => [
      receptionist.account_id,
      receptionist,
    ]),
  );

  const dentistServicesMap = new Map();
  (dentistServicesResult.data || []).forEach((assignment) => {
    const service = assignment.service;
    if (!service) return;

    const currentServices = dentistServicesMap.get(assignment.dentist_id) || [];
    currentServices.push({
      id: service.service_id,
      name: service.service_name || "Not updated",
    });
    dentistServicesMap.set(assignment.dentist_id, currentServices);
  });

  let staff = staffAccounts.map((account) =>
    mapStaffAccount(account, dentistMap, receptionistMap, dentistServicesMap),
  );

  if (role && role != "all") {
    staff = staff.filter((item) => item.role === role.toLowerCase());
  }

  if (status && status !== "all") {
    staff = staff.filter(
      (item) => item.status.toLowerCase() === status.toLowerCase(),
    );
  }

  if (search) {
    const keyword = search.trim().toLowerCase();
    staff = staff.filter((item) =>
      item.fullName.toLowerCase().includes(keyword),
    );
  }

  return staff;
}

async function getAvailableStaffAccounts() {
  const { data: accounts, error: accountError } =
    await staffDao.findStaffAccounts();
  if (accountError) throw new AppError(accountError.message, 500, "DB_ERROR");
  const accountIds = (accounts || []).map((account) => account.account_id);
  if (!accountIds.length) return [];

  const [dentists, receptionists] = await Promise.all([
    staffDao.findDentistByAccountIds(accountIds),
    staffDao.findRepceptionistByAccountIds(accountIds),
  ]);
  if (dentists.error)
    throw new AppError(dentists.error.message, 500, "DB_ERROR");
  if (receptionists.error)
    throw new AppError(receptionists.error.message, 500, "DB_ERROR");

  const linked = new Set([
    ...(dentists.data || []).map((profile) => profile.account_id),
    ...(receptionists.data || []).map((profile) => profile.account_id),
  ]);
  return (accounts || [])
    .filter((account) => !linked.has(account.account_id))
    .map((account) => ({
      accountId: account.account_id,
      username: account.username || "",
      email: account.email || "",
      phone: account.phone || "",
      role: normalizeRoleName(account),
      status: account.status || "Inactive",
    }));
}

async function createStaffProfile(payload) {
  const accounts = await getAvailableStaffAccounts();
  const account = accounts.find(
    (item) =>
      item.accountId === payload.accountId && item.role === payload.role,
  );
  if (!account)
    throw new AppError(
      "Tài khoản nhân viên không hợp lệ hoặc đã có hồ sơ.",
      404,
      "STAFF_ACCOUNT_NOT_FOUND",
    );
  if (!account.email || !account.phone)
    throw new AppError(
      "Tài khoản phải có email và số điện thoại.",
      400,
      "ACCOUNT_CONTACT_REQUIRED",
    );

  const common = {
    account_id: payload.accountId,
    full_name: payload.fullName,
    email: account.email,
    phone: account.phone,
    birth_date: payload.birthDate,
    gender: payload.gender,
    address: payload.address,
  };

  let services = [];
  if (payload.role === "dentist") {
    const serviceResult = await staffDao.findActiveServicesByIds(
      payload.serviceIds,
    );
    if (serviceResult.error) {
      throw new AppError(serviceResult.error.message, 500, "DB_ERROR");
    }
    services = serviceResult.data || [];
    if (services.length !== payload.serviceIds.length) {
      throw new AppError(
        "Dịch vụ không tồn tại hoặc đã ngừng hoạt động.",
        400,
        "INVALID_SERVICES",
      );
    }
  }

  const result =
    payload.role === "dentist"
      ? await staffDao.createDentistProfile({
          ...common,
          speciality: payload.speciality,
          experience: payload.experience,
        })
      : await staffDao.createReceptionistProfile(common);
  if (result.error) {
    if (result.error.code === "23505")
      throw new AppError("Tài khoản đã có hồ sơ.", 409, "STAFF_PROFILE_EXISTS");
    throw new AppError(result.error.message, 500, "DB_ERROR");
  }
  if (payload.role === "dentist") {
    const assignments = payload.serviceIds.map((serviceId) => ({
      dentist_id: result.data.dentist_id,
      service_id: serviceId,
    }));
    const assignmentResult = await staffDao.createDentistServices(assignments);
    if (assignmentResult.error) {
      await staffDao.deleteDentistProfile(result.data.dentist_id);
      throw new AppError(assignmentResult.error.message, 500, "DB_ERROR");
    }
  }

  return {
    ...result.data,
    role: payload.role,
    services: services.map((service) => ({
      id: service.service_id,
      name: service.service_name,
    })),
  };
}

async function updateDentistProfile(dentistId, payload) {
  const { data: existing, error: findError } =
    await staffDao.findDentistProfileById(dentistId);
  if (findError) throw new AppError(findError.message, 500, "DB_ERROR");
  if (!existing)
    throw new AppError(
      "Không tìm thấy hồ sơ nha sĩ.",
      404,
      "DENTIST_NOT_FOUND",
    );

  const { data: services, error: serviceError } =
    await staffDao.findActiveServicesByIds(payload.serviceIds);
  if (serviceError) throw new AppError(serviceError.message, 500, "DB_ERROR");
  if ((services || []).length !== payload.serviceIds.length) {
    throw new AppError(
      "Dịch vụ không tồn tại hoặc đã ngừng hoạt động.",
      400,
      "INVALID_SERVICES",
    );
  }

  const { data: profile, error: updateError } =
    await staffDao.updateDentistProfile(dentistId, {
      full_name: payload.fullName,
      birth_date: payload.birthDate,
      gender: payload.gender,
      address: payload.address,
      speciality: payload.speciality,
      experience: payload.experience,
    });
  if (updateError) throw new AppError(updateError.message, 500, "DB_ERROR");

  const { error: deleteError } =
    await staffDao.deleteDentistServices(dentistId);
  if (deleteError) throw new AppError(deleteError.message, 500, "DB_ERROR");
  const { error: insertError } = await staffDao.createDentistServices(
    payload.serviceIds.map((serviceId) => ({
      dentist_id: dentistId,
      service_id: serviceId,
    })),
  );
  if (insertError) throw new AppError(insertError.message, 500, "DB_ERROR");

  return {
    profileId: profile.dentist_id,
    accountId: profile.account_id,
    fullName: profile.full_name,
    email: profile.email,
    phone: profile.phone,
    birthDate: profile.birth_date,
    gender: profile.gender,
    address: profile.address,
    speciality: profile.speciality,
    experience: profile.experience,
    services: (services || []).map((service) => ({
      id: service.service_id,
      name: service.service_name,
    })),
  };
}

async function updateReceptionistProfile(receptionistId, payload) {
  const { data: existing, error: findError } =
    await staffDao.findReceptionistProfileById(receptionistId);
  if (findError) throw new AppError(findError.message, 500, "DB_ERROR");
  if (!existing) {
    throw new AppError(
      "Không tìm thấy hồ sơ lễ tân.",
      404,
      "RECEPTIONIST_NOT_FOUND",
    );
  }

  const { data: profile, error: updateError } =
    await staffDao.updateReceptionistProfile(receptionistId, {
      full_name: payload.fullName,
      birth_date: payload.birthDate,
      gender: payload.gender,
      address: payload.address,
    });
  if (updateError) throw new AppError(updateError.message, 500, "DB_ERROR");

  return {
    profileId: profile.receptionist_id,
    accountId: profile.account_id,
    fullName: profile.full_name,
    email: profile.email,
    phone: profile.phone,
    birthDate: profile.birth_date,
    gender: profile.gender,
    address: profile.address,
    role: "receptionist",
  };
}

module.exports = {
  createDentistProfile,
  getAvailableDentistAccounts,
  getAvailableStaffAccounts,
  createStaffProfile,
  getAllStaff,
  updateDentistProfile,
  updateReceptionistProfile,
};
