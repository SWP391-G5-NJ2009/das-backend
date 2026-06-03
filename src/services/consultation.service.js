const supabase = require("../config/supabase")
const AppError = require("../utils/AppError")

function ensureSupabase() {
    if (!supabase) {
        throw new AppError("Supabase is not configured.", 500, "SUPABASE_NOT_CONFIGURED");
    }
}

async function createConsultationRequest({ full_name, phone, email, description }) {
    ensureSupabase();

    const { data, error } = await supabase
        .from("consultation_request")
        .insert({
            full_name,
            phone,
            email,
            description,
        })
        .select("full_name, phone, email, description")
        .single();

    if (error) {
        throw new AppError(error.message, 500, "DB_ERROR");
    }

    return data;
}

module.exports = {
    createConsultationRequest,
};