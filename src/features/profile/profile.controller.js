const profileService = require("./profile.service");
const { validateUpdateMyProfile } = require("./profile.validator");
const { sendSuccess } = require("../../utils/response");

async function getMyProfile(req, res, next) {
  try {
    const data = await profileService.getMyProfile(req.user.id);
    return sendSuccess(res, 200, data, "Lấy hồ sơ thành công.");
  } catch (err) {
    return next(err);
  }
}

async function updateMyProfile(req, res, next) {
  try {
    const payload = validateUpdateMyProfile(req.body);
    const data = await profileService.updateMyProfile(req.user.id, payload);
    return sendSuccess(res, 200, data, "Cập nhật hồ sơ thành công.");
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getMyProfile,
  updateMyProfile,
};
