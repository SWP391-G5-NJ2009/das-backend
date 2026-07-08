const clinicInfoService = require("./clinicInfo.service");
const { sendSuccess } = require("../../utils/response");

async function getPublicClinicInfo(req, res, next) {
  try {
    const clinicInfo = await clinicInfoService.getPublicClinicInfo();
    return sendSuccess(
      res,
      200,
      clinicInfo,
      "Clinic information retrieved successfully.",
    );
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getPublicClinicInfo,
};
