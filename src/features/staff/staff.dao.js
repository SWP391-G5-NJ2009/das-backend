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
            speciality
            `,
        )
        .in("account_id", accountIds);
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
    findDentistByAccountIds,
    findRepceptionistByAccountIds,
    findStaffAccounts,
}