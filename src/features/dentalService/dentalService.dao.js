const supabase = require("../../config/supabase");

async function findAllServices() {
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

async function findActivePublicServices() {
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
      service_categories (category_name)
    `,
    )
    .eq("status", "Active")
    .order("service_id", { ascending: true });
}

async function deleteService(id) {
  return supabase
    .from("dental_services")
    .delete()
    .eq("service_id", id)
    .select();
}

async function insertService(payload) {
  return supabase.from("dental_services").insert([payload]).select();
}

async function findAllCategories() {
  return supabase
    .from("service_categories")
    .select("category_id, category_name, description")
    .order("category_id", { ascending: true });
}

async function updateService(id, payload) {
  return supabase
    .from("dental_services")
    .update(payload)
    .eq("service_id", id)
    .select();
}

async function findDentistsByServiceId(serviceId) {
  return supabase
    .from("dentist_services")
    .select(
      `
      dentist:dentist_id (
        dentist_id,
        full_name,
        speciality,
        experience,
        account:account_id (
          username,
          email,
          status
        )
      )
    `,
    )
    .eq("service_id", serviceId);
}

module.exports = {
  deleteService,
  findActivePublicServices,
  findAllCategories,
  findAllServices,
  findDentistsByServiceId,
  insertService,
  updateService,
};
