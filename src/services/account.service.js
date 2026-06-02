const supabase = require("../config/supabase")
const AppError = require("../utils/AppError")

function ensureSupabase() {
    if (!supabase) {
        throw new AppError("Supabase is not configured.", 500, "SUPABASE_NOT_CONFIGURED");
    }
}

async function getAllAccounts() {
    ensureSupabase();

    const { data, error } = await supabase
        .from("account")
        .select("account_id, email, username, status, created_date, role(role_name)")
        .order("created_date", { ascending: false });

    if (error) {
        throw new AppError(error.message, 500, "DB_ERROR");
    }

    return data || [];
}

module.exports = {
    getAllAccounts,
};