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

async function findRepceptionistByAccountIds(accountIds) {
    return supabase
        .from("receptionist")
        .select(
            `
            receptionist_id,
            account_id,
            full_name,
            email,
            phone
            `,
        )
        .in("account_id", accountIds);
}

module.exports = {
    createDentistProfile,
    findDentistAccounts,
    findDentistByAccountIds,
    findDentistProfileByAccountId,
    findRepceptionistByAccountIds,
    findStaffAccounts,
}
