const supabase = require("../config/supabase")
const AppError = require("../utils/AppError")

function ensureSupabase() {
    if (!supabase) {
        throw new AppError("Supabase is not configured.", 500, "SUPABASE_NOT_CONFIGURED");
    }
}

async function getAllConsultationRequests() {
    ensureSupabase();

    const { data, error } = await supabase
        .from("consultation_request")
        .select("*")
        .order("created_at", { ascending: false });

    if (error) {
        throw new AppError(error.message, 500, "DB_ERROR");
    }

    return data || [];
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

async function updateConsultationRequest(id, { status, note }) {
    ensureSupabase();

    const updateFields = {};

    if (status !== undefined) {
        updateFields.status = status;
    }

    if (note !== undefined) {
        updateFields.note = note;
    }


    const { data, error } = await supabase
        .from("consultation_request")
        .update(updateFields)
        .eq("id", id)
        .select("*")
        .single();

    if (error) {
        throw new AppError(error.message, 500, "DB_ERROR");
    }

    return data;

}

module.exports = {
    getAllConsultationRequests,
    createConsultationRequest,
    updateConsultationRequest,
};