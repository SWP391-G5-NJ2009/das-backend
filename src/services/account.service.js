const bcrypt = require("bcryptjs");
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

async function createAccount({ username, email, phone, password, role_name, status}) {
    ensureSupabase();

    const { data: existing } = await supabase
        .from("account")
        .select("account_id")
        .eq("username", username)
        .maybeSingle();
    
    if (existing) {
        throw new AppError("Username already exists.", 409, "DUPLICATE_USERNAME");
    }

    const { data: role, error: roleError } = await supabase
        .from("role")
        .select("role_id")
        .ilike("role_name", role_name)
        .single();
    
    if (roleError || !role) {
        throw new AppError(`Role '${role_name}' not found.`, 400, "INVALID_ROLE");
    }

    const password_hash = await bcrypt.hash(password, 10);

    const { data, error } = await supabase
    .from("account")
    .insert({
      username,
      email,
      phone,
      password: password_hash,
      password_hash,
      role_id: role.role_id,
      status: status || "Active",
    })
    .select("account_id, email, username, status, created_date, role(role_name)")
    .single();
    
    if (error) {
        throw new AppError(error.message, 500, "DB_ERROR");
    }

    return data;
}

module.exports = {
    getAllAccounts,
    createAccount
};