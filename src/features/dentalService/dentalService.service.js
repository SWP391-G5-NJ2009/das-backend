const dentalServiceDao = require("./dentalService.dao");
const AppError = require("../../utils/AppError");

function mapServicePayload({
  service_name,
  category_id,
  description,
  unit_price,
  slot_occupied,
  status,
}) {
  return {
    service_name,
    category_id: Number(category_id),
    description: description || null,
    unit_price: Number(unit_price),
    slot_occupied: Number(slot_occupied) || 1,
    status: status || "Inactive",
  };
}

async function getAllServices() {
  const { data, error } = await dentalServiceDao.findAllServices();

  if (error) {
    throw new AppError(
      "Failed to load service list. Please try again later.",
      500,
      "DB_ERROR",
    );
  }

  return data || [];
}

async function deleteService(id) {
  const { data, error } = await dentalServiceDao.deleteService(id);

  if (error) {
    throw new AppError(
      "Failed to delete service. Please try again later.",
      500,
      "DB_ERROR",
    );
  }

  if (!data || data.length === 0) {
    throw new AppError(
      "Failed to find service with the requested ID.",
      404,
      "NOT_FOUND",
    );
  }

  return { service_id: id };
}

async function createService(payload) {
  const { data, error } = await dentalServiceDao.insertService(
    mapServicePayload(payload),
  );

  if (error) {
    throw new AppError(
      "Failed to create new dental service. Database execution error.",
      500,
      "DB_ERROR",
    );
  }

  return data?.[0] || null;
}

async function getAllCategories() {
  const { data, error } = await dentalServiceDao.findAllCategories();

  if (error) {
    throw new AppError(
      "Failed to load service categories. Please try again later.",
      500,
      "DB_ERROR",
    );
  }

  return data || [];
}

async function updateService(id, payload) {
  const { data, error } = await dentalServiceDao.updateService(
    id,
    mapServicePayload(payload),
  );

  if (error) {
    throw new AppError(
      "Failed to update service. Database error occurred.",
      500,
      "DB_ERROR",
    );
  }

  if (!data || data.length === 0) {
    throw new AppError(
      "Failed to find service with the requested ID to update.",
      404,
      "NOT_FOUND",
    );
  }

  return data[0];
}

async function getDentistsByServiceId(serviceId) {
  const { data, error } =
    await dentalServiceDao.findDentistsByServiceId(serviceId);

  if (error) {
    throw new AppError(
      "Failed to load dentists for this service.",
      500,
      "DB_ERROR",
    );
  }

  // Flatten join: [{ dentist: { dentist_id, speciality, account: { username } } }]
  return (data || [])
    .map((row) => row.dentist)
    .filter(Boolean)
    .map((d) => ({
      dentist_id: d.dentist_id,
      full_name:
        d.account?.username || d.account?.email || `Dentist #${d.dentist_id}`,
      specialization: d.speciality || "",
      experience: d.experience || "",
    }));
}

module.exports = {
  createService,
  deleteService,
  getAllCategories,
  getAllServices,
  getDentistsByServiceId,
  updateService,
};
