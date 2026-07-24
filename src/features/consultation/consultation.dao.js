const supabase = require("../../config/supabase");

async function findAllConsultationRequests(filters = {}) {
  const PAGE_SIZE = 20;
  const page = parseInt(filters.pagination) || 1;

  let query = supabase
    .from("consultation_request")
    .select("*, dental_services(service_name)", { count: "exact" })
    .range((page-1)*PAGE_SIZE, page*PAGE_SIZE-1);

  if (filters.status && filters.status !== "All") {
    query = query.eq("status", filters.status);
  }

  if (filters.status && filters.status === "Pending") {
    query = query.order("created_at", { ascending: true });
  } else {
    query = query.order("created_at", { ascending: false });
  }

  if (filters.search) {
    const s = `%${filters.search}%`;
    query = query.or(`full_name.ilike.${s},phone.ilike.${s},email.ilike.${s},description.ilike.${s}`);
  }

  if (filters.from_date) {
    const start = new Date(filters.from_date);
    query = query.gte("created_at", start.toISOString());
  }

  if (filters.to_date) {
    const end = new Date(filters.to_date);
    end.setDate(end.getDate() + 1);
    query = query.lt("created_at", end.toISOString());
  }

  return query;
}

async function insertConsultationRequest(payload) {
  return supabase
    .from("consultation_request")
    .insert(payload)
    .select("full_name, phone, email, description, service_id, consultation_date")
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
