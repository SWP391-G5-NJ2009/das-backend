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
        profileId: 
            role === "dentist"
                ? profile?.dentist_id || null
                : profile?.receptionist_id || null,
        fullName: profile?.full_name || account.username || "Not updated",
        email: profile?.email || account.email || "",
        phone: profile?.phone || account.phone || "",
        role: role,
        position: role === "dentist" ? profile?.speciality || "Dentist" : "Receptionist",
        status: account.status || "Inactive",
        createdDate: account.created_date,
    }
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
  getAllStaff,
}
