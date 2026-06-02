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
        .select("account_id, username, email, phone, status, created_date, role(role_name)")
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

async function updateAccount(accountId, { username, email, phone, password, role_name, status }) {
    ensureSupabase();

    const updateFields = {};

    if (username !== undefined) {
        const { data: existing } = await supabase
            .from("account")
            .select("account_id")
            .eq("username", username)
            .neq("account_id", accountId)
            .maybeSingle();

        if (existing) {
            throw new AppError("Username already exists.", 409, "DUPLICATE_USERNAME");
        }
        updateFields.username = username;
    }

    if (email !== undefined) {
        updateFields.email = email;
    }

    if (phone !== undefined) {
        updateFields.phone = phone;
    }

    if (password !== undefined) {
        updateFields.password = await bcrypt.hash(password, 10);
        updateFields.password_hash = updateFields.password;
    }

    if (role_name !== undefined) {
        const { data: role, error: roleError } = await supabase
            .from("role")
            .select("role_id")
            .ilike("role_name", role_name)
            .single();

        if (roleError || !role) {
            throw new AppError(`Role '${role_name}' not found.`, 400, "INVALID_ROLE");
        }
        updateFields.role_id = role.role_id;
    }

    if (status !== undefined) {
        updateFields.status = status;
    }

    if (Object.keys(updateFields).length === 0) {
        throw new AppError("No fields to update.", 400, "NO_UPDATES");
    }

    const { data, error } = await supabase
        .from("account")
        .update(updateFields)
        .eq("account_id", accountId)
        .select("account_id, email, username, status, created_date, role(role_name)")
        .single();

    if (error) {
        throw new AppError(error.message, 500, "DB_ERROR");
    }

    return data;
}

async function deleteAccount(accountId) {
    ensureSupabase();

    const { data: existing } = await supabase
        .from("account")
        .select("account_id")
        .eq("account_id", accountId)
        .single();

    if (!existing) {
        throw new AppError("Account not found.", 404, "NOT_FOUND");
    }

    const { error } = await supabase
        .from("account")
        .delete()
        .eq("account_id", accountId);

    if (error) {
        throw new AppError(error.message, 500, "DB_ERROR");
    }

    return { account_id: accountId };
}

module.exports = {
    getAllAccounts,
    createAccount,
    updateAccount,
    deleteAccount,
};