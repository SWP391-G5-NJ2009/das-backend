const supabase = require("../config/supabase");

async function dbGetAllServices() {
  const { data, error } = await supabase
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

  return { data, error };
}

async function dbDeleteService(id) {
  const { data, error } = await supabase
    .from("dental_services")
    .delete()
    .eq("service_id", id)
    .select();

  return { data, error };
}

async function dbCreateService(serviceData) {
  const {
    service_name,
    category_id,
    description,
    unit_price,
    slot_occupied,
    status,
  } = serviceData;

  const { data, error } = await supabase
    .from("dental_services")
    .insert([
      {
        service_name,
        category_id,
        description: description || null,
        unit_price: Number(unit_price),
        slot_occupied: Number(slot_occupied) || 1,
        status: status || "Active",
      },
    ])
    .select();

  return { data, error };
}

async function dbGetAllCategories() {
  const { data, error } = await supabase
    .from("service_categories")
    .select("category_id, category_name, description")
    .order("category_id", { ascending: true });

  return { data, error };
}

async function dbUpdateService(id, updateData) {
  const {
    service_name,
    category_id,
    description,
    unit_price,
    slot_occupied,
    status,
  } = updateData;

  const { data, error } = await supabase
    .from("dental_services")
    .update({
      service_name,
      category_id: Number(category_id),
      description: description || null,
      unit_price: Number(unit_price),
      slot_occupied: Number(slot_occupied) || 1,
      status: status || "Active",
    })
    .eq("service_id", id)
    .select();

  return { data, error };
}

module.exports = {
  dbGetAllServices,
  dbDeleteService,
  dbCreateService,
  dbGetAllCategories,
  dbUpdateService,
};
