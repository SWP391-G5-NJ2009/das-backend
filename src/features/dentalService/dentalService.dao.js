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

async function findAllServices() {
  ensureSupabase();

  return supabase
    .from("dental_services")
    .select(
      `
      service_id,
      category_id,
      service_name,
      description,
      unit_price,
      slot_occupied,
      status,
      service_categories (category_name)
    `,
    )
    .order("service_id", { ascending: true });
}

async function deleteService(id) {
  ensureSupabase();

  return supabase
    .from("dental_services")
    .delete()
    .eq("service_id", id)
    .select();
}

async function insertService(payload) {
  ensureSupabase();

  return supabase.from("dental_services").insert([payload]).select();
}

async function findAllCategories() {
  ensureSupabase();

  return supabase
    .from("service_categories")
    .select("category_id, category_name, description")
    .order("category_id", { ascending: true });
}

async function updateService(id, payload) {
  ensureSupabase();

  return supabase
    .from("dental_services")
    .update(payload)
    .eq("service_id", id)
    .select();
}

module.exports = {
  deleteService,
  findAllCategories,
  findAllServices,
  insertService,
  updateService,
};
