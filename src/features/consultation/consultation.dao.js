const supabase = require("../../config/supabase");

async function findAllConsultationRequests(filters = {}) {
  const PAGE_SIZE = 20;
  const page = parseInt(filters.pagination) || 1;

  let query = supabase
    .from("consultation_request")
    .select("*", { count: "exact" })
    .order("created_at", { ascending: true })
    .range((page-1)*PAGE_SIZE, page*PAGE_SIZE-1);

  if (filters.status && filters.status !== "All") {
    query = query.eq("status", filters.status)
  }

  if (filters.search) {
    const s = `%${filters.search}%`;
    query = query.or(`full_name.ilike.${s},phone.ilike.${s},email.ilike.${s},description.ilike.${s}`);
  }

  if (filters.date) {
    const start = new Date(filters.date);
    //const end = new Date(start);
    query = query.gte("created_at", start.toISOString());
    // .lt("created_at", end.toISOString());

  }

  return query;
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
