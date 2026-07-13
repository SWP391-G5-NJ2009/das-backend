const dentalServiceService = require("./dentalService.service");
const { sendSuccess } = require("../../utils/response");
const { validateServicePayload } = require("./dentalService.validator");

async function getAllServices(req, res, next) {
  try {
    const services = await dentalServiceService.getAllServices();
    return sendSuccess(res, 200, services, "Lấy danh sách dịch vụ thành công.");
  } catch (error) {
    return next(error);
  }
}

async function getPublicServices(req, res, next) {
  try {
    const services = await dentalServiceService.getPublicServices();
    return sendSuccess(
      res,
      200,
      services,
      "Lấy danh sách dịch vụ công khai thành công.",
    );
  } catch (error) {
    return next(error);
  }
}

async function deleteService(req, res, next) {
  try {
    const { id } = req.params;
    const data = await dentalServiceService.deleteService(id);
    return sendSuccess(res, 200, data, "Xóa dịch vụ thành công.");
  } catch (error) {
    return next(error);
  }
}

async function createService(req, res, next) {
  try {
    const payload = validateServicePayload(req.body);
    const data = await dentalServiceService.createService(payload);
    return sendSuccess(res, 201, data, "Tạo dịch vụ thành công.");
  } catch (error) {
    return next(error);
  }
}

async function getAllCategories(req, res, next) {
  try {
    const categories = await dentalServiceService.getAllCategories();
    return sendSuccess(
      res,
      200,
      categories,
      "Lấy danh mục dịch vụ thành công.",
    );
  } catch (error) {
    return next(error);
  }
}

async function updateService(req, res, next) {
  try {
    const { id } = req.params;
    const payload = validateServicePayload(req.body);
    const data = await dentalServiceService.updateService(id, payload);
    return sendSuccess(res, 200, data, "Cập nhật dịch vụ thành công.");
  } catch (error) {
    return next(error);
  }
}

async function getDentistsByService(req, res, next) {
  try {
    const { id } = req.params;
    const dentists = await dentalServiceService.getDentistsByServiceId(id);
    return sendSuccess(res, 200, dentists, "Lấy danh sách nha sĩ thành công.");
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createService,
  deleteService,
  getAllCategories,
  getAllServices,
  getDentistsByService,
  getPublicServices,
  updateService,
};
