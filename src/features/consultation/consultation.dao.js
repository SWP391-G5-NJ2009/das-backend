const supabase = require("../../config/supabase");
const AppError = require("../../utils/AppError");

function ensureSupabase() {
  if (!supabase) {
    throw new AppError(
      "Supabase is not configured.",
      500,
      "SUPABASE_NOT_CONFIGURED",
    );
  }
}

async function findAllConsultationRequests(filters = {}) {
  ensureSupabase();

  let query = supabase
    .from("consultation_request")
    .select("*")
    .order("created_at", { ascending: false });

  if (filters.status && filters.status !== "All") {
    query = query.eq("status", filters.status)
  }

  return query;
}

async function insertConsultationRequest(payload) {
  ensureSupabase();

  return supabase
    .from("consultation_request")
    .insert(payload)
    .select("full_name, phone, email, description")
    .single();
}

async function updateConsultationRequest(id, updateFields) {
  ensureSupabase();

  return supabase
    .from("consultation_request")
    .update(updateFields)
    .eq("id", id)
    .select("*")
    .single();
}

module.exports = {
  findAllConsultationRequests,
  insertConsultationRequest,
  updateConsultationRequest,
};
