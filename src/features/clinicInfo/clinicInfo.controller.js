const clinicInfoService = require("./clinicInfo.service");
const { sendSuccess } = require("../../utils/response");
const { validateUpdateClinicInfo } = require("./clinicInfo.validator");

async function getPublicClinicInfo(req, res, next) {
  try {
    const clinicInfo = await clinicInfoService.getPublicClinicInfo();
    return sendSuccess(
      res,
      200,
      clinicInfo,
      "Lấy thông tin phòng khám thành công.",
    );
  } catch (error) {
    return next(error);
  }
}

async function updateClinicInfo(req, res, next) {
  try {
    const payload = validateUpdateClinicInfo(req.body);
    const clinicInfo = await clinicInfoService.updateClinicInfo(payload);
    return sendSuccess(
      res,
      200,
      clinicInfo,
      "Cập nhật thông tin phòng khám thành công.",
    );
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getPublicClinicInfo,
  updateClinicInfo,
};
