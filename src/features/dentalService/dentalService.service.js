const dentalServiceDao = require("./dentalService.dao");
const appointmentDao = require("../appointment/appointment.dao");
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
      "Không thể tải danh sách dịch vụ. Vui lòng thử lại sau.",
      500,
      "DB_ERROR",
    );
  }

  return data || [];
}

function mapPublicService(row) {
  const slotOccupied = Number(row.slot_occupied) || 1;
  const durationMinutes = slotOccupied * 30;

  return {
    service_id: row.service_id,
    category_id: row.category_id,
    service_name: row.service_name,
    description: row.description || "",
    category_name: row.service_categories?.category_name || "",
    unit_price: Number(row.unit_price) || 0,
    price: Number(row.unit_price) || 0,
    slot_occupied: slotOccupied,
    duration_minutes: durationMinutes,
    duration: `${durationMinutes} minutes`,
    process: null,
  };
}

async function getPublicServices() {
  const { data, error } = await dentalServiceDao.findActivePublicServices();

  if (error) {
    throw new AppError(
      "Không thể tải danh sách dịch vụ công khai. Vui lòng thử lại sau.",
      500,
      "DB_ERROR",
    );
  }

  return (data || []).map(mapPublicService);
}

async function deleteService(id) {
  // BR-25: Hard-deletion is blocked if the service has EVER been linked to
  // any appointment record, regardless of status (past, cancelled, completed…).
  const everBooked = await appointmentDao.hasAnyAppointmentByServiceId(id);
  if (everBooked) {
    throw new AppError(
      "Không thể xóa dịch vụ này vì đã có lịch hẹn liên kết. Vui lòng chuyển trạng thái sang 'Ngừng hoạt động' để ẩn dịch vụ thay vì xóa.",
      409,
      "SERVICE_HAS_HISTORY",
    );
  }

  const { data, error } = await dentalServiceDao.deleteService(id);

  if (error) {
    throw new AppError(
      "Không thể xóa dịch vụ. Vui lòng thử lại sau.",
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
      "Không thể tải danh mục dịch vụ. Vui lòng thử lại sau.",
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

  return (data || [])
    .map((row) => row.dentist)
    .filter(Boolean)
    .filter((d) => d.account?.status !== "Deactivated")
    .map((d) => ({
      dentist_id: d.dentist_id,
      full_name: d.full_name || d.account?.email || `Dentist #${d.dentist_id}`,
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
  getPublicServices,
  updateService,
};
