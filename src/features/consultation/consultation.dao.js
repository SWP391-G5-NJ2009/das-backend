const supabase = require("../../config/supabase");

async function findAllConsultationRequests() {
  return supabase
    .from("consultation_request")
    .select("*")
    .order("created_at", { ascending: false });
}

async function insertConsultationRequest(payload) {
  return supabase
    .from("consultation_request")
    .insert(payload)
    .select("full_name, phone, email, description")
    .single();
}

async function updateConsultationRequest(id, updateFields) {
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
