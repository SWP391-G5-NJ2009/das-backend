const authService = require("./auth.service");
const { sendSuccess } = require("../../utils/response");
const {
  changePasswordSchema,
  forgotPasswordSchema,
  patientLoginSchema,
  resetPasswordSchema,
  staffForgotPasswordSchema,
  staffLoginSchema,
  validate,
  verifyOtpSchema,
} = require("./auth.validator");

async function patientLogin(req, res, next) {
  try {
    const payload = validate(patientLoginSchema, req.body);
    const data = await authService.patientLogin(payload);
    return sendSuccess(res, 200, data, "Đăng nhập thành công. Chào mừng bạn trở lại!");
  } catch (err) {
    return next(err);
  }
}

async function staffLogin(req, res, next) {
  try {
    const payload = validate(staffLoginSchema, req.body);
    const data = await authService.staffLogin(payload);
    return sendSuccess(res, 200, data, "Đăng nhập thành công. Chào mừng bạn trở lại!");
  } catch (err) {
    return next(err);
  }
}

async function logout(req, res) {
  return sendSuccess(res, 200, null, "Đăng xuất thành công.");
}

async function forgotPassword(req, res, next) {
  try {
    const payload = validate(forgotPasswordSchema, req.body);
    const data = await authService.forgotPassword(payload);
    return sendSuccess(res, 200, data, "Đã tạo mã OTP.");
  } catch (err) {
    return next(err);
  }
}

async function staffForgotPassword(req, res, next) {
  try {
    const payload = validate(staffForgotPasswordSchema, req.body);
    const data = await authService.staffForgotPassword(payload);
    return sendSuccess(res, 200, data, "Đã tạo mã OTP.");
  } catch (err) {
    return next(err);
  }
}

async function verifyOtp(req, res, next) {
  try {
    const payload = validate(verifyOtpSchema, req.body);
    const data = await authService.verifyOtp(payload);
    return sendSuccess(res, 200, data, "Xác minh OTP thành công.");
  } catch (err) {
    return next(err);
  }
}

async function resetPassword(req, res, next) {
  try {
    const payload = validate(resetPasswordSchema, req.body);
    const data = await authService.resetPassword(payload);
    return sendSuccess(
      res,
      200,
      data,
      "Đặt lại mật khẩu thành công.",
    );
  } catch (err) {
    return next(err);
  }
}

async function changePassword(req, res, next) {
  try {
    const payload = validate(changePasswordSchema, req.body);
    const data = await authService.changePassword({
      accountId: req.user.id,
      ...payload,
    });
    return sendSuccess(
      res,
      200,
      data,
      "Đổi mật khẩu thành công.",
    );
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  changePassword,
  forgotPassword,
  logout,
  patientLogin,
  resetPassword,
  staffForgotPassword,
  staffLogin,
  verifyOtp,
};
