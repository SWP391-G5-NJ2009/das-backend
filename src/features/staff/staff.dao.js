const supabase = require("../../config/supabase");
async function findStaffAccounts() {
  return supabase
    .from("account")
    .select(
      `
            account_id,
            username,
            email,
            phone,
            status,
            created_date,
            role!inner(role_name)
            
            `,
    )
    .in("role.role_name", ["Dentist", "Receptionist"])
    .order("created_date", { ascending: false });
}

async function findDentistByAccountIds(accountIds) {
  return supabase
    .from("dentist")
    .select(
      `
            dentist_id,
            account_id,
            full_name,
            email,
            phone,
            birth_date,
            gender,
            address,
            speciality,
            experience
            `,
    )
    .in("account_id", accountIds);
}

async function findDentistServicesByDentistIds(dentistIds) {
  if (!dentistIds.length) {
    return { data: [], error: null };
  }

  return supabase
    .from("dentist_services")
    .select(
      `
            dentist_id,
            service_id,
            service:dental_services!dentist_services_service_id_fkey (
                service_id,
                service_name
            )
            `,
    )
    .in("dentist_id", dentistIds);
}

async function findDentistAccounts() {
  return supabase
    .from("account")
    .select(
      `
            account_id,
            username,
            email,
            phone,
            status,
            role!inner(role_name)
            `,
    )
    .eq("role.role_name", "Dentist")
    .order("username", { ascending: true });
}

async function findDentistProfileByAccountId(accountId) {
  return supabase
    .from("dentist")
    .select("dentist_id, account_id")
    .eq("account_id", accountId)
    .maybeSingle();
}

async function createDentistProfile(payload) {
  return supabase
    .from("dentist")
    .insert(payload)
    .select(
      "dentist_id, account_id, full_name, email, phone, birth_date, gender, address, speciality, experience",
    )
    .single();
}

async function deleteDentistProfile(dentistId) {
  return supabase.from("dentist").delete().eq("dentist_id", dentistId);
}

async function createReceptionistProfile(payload) {
  return supabase
    .from("receptionist")
    .insert(payload)
    .select(
      "receptionist_id, account_id, full_name, email, phone, birth_date, gender, address",
    )
    .single();
}

async function findDentistProfileById(dentistId) {
  return supabase
    .from("dentist")
    .select("dentist_id, account_id, email, phone")
    .eq("dentist_id", dentistId)
    .maybeSingle();
}

async function findReceptionistProfileById(receptionistId) {
  return supabase
    .from("receptionist")
    .select("receptionist_id, account_id, email, phone")
    .eq("receptionist_id", receptionistId)
    .maybeSingle();
}

async function updateDentistProfile(dentistId, payload) {
  return supabase
    .from("dentist")
    .update(payload)
    .eq("dentist_id", dentistId)
    .select(
      "dentist_id, account_id, full_name, email, phone, birth_date, gender, address, speciality, experience",
    )
    .single();
}

async function updateReceptionistProfile(receptionistId, payload) {
  return supabase
    .from("receptionist")
    .update(payload)
    .eq("receptionist_id", receptionistId)
    .select(
      "receptionist_id, account_id, full_name, email, phone, birth_date, gender, address",
    )
    .single();
}

async function findActiveServicesByIds(serviceIds) {
  if (!serviceIds.length) return { data: [], error: null };
  return supabase
    .from("dental_services")
    .select("service_id, service_name")
    .in("service_id", serviceIds)
    .eq("status", "Active");
}

async function deleteDentistServices(dentistId) {
  return supabase.from("dentist_services").delete().eq("dentist_id", dentistId);
}

async function createDentistServices(assignments) {
  if (!assignments.length) return { data: [], error: null };
  return supabase
    .from("dentist_services")
    .insert(assignments)
    .select("dentist_id, service_id");
}

async function findRepceptionistByAccountIds(accountIds) {
  return supabase
    .from("receptionist")
    .select(
      `
            receptionist_id,
            account_id,
            full_name,
            email,
            phone,
            birth_date,
            gender,
            address
            `,
    )
    .in("account_id", accountIds);
}

module.exports = {
  createDentistProfile,
  deleteDentistProfile,
  createReceptionistProfile,
  createDentistServices,
  deleteDentistServices,
  findActiveServicesByIds,
  findDentistAccounts,
  findDentistByAccountIds,
  findDentistServicesByDentistIds,
  findDentistProfileByAccountId,
  findDentistProfileById,
  findRepceptionistByAccountIds,
  findReceptionistProfileById,
  findStaffAccounts,
  updateDentistProfile,
  updateReceptionistProfile,
};
