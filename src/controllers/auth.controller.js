const authService = require("../services/auth.service");
const { sendSuccess } = require("../utils/response");
const {
  changePasswordSchema,
  forgotPasswordSchema,
  patientLoginSchema,
  resetPasswordSchema,
  staffLoginSchema,
  validate,
  verifyOtpSchema,
} = require("../validators/auth.validator");

async function patientLogin(req, res, next) {
  try {
    const payload = validate(patientLoginSchema, req.body);
    const data = await authService.patientLogin(payload);
    return sendSuccess(res, 200, data, "Login successful. Welcome back!");
  } catch (err) {
    return next(err);
  }
}

async function staffLogin(req, res, next) {
  try {
    const payload = validate(staffLoginSchema, req.body);
    const data = await authService.staffLogin(payload);
    const token = data.token || data.accessToken;
    console.log("=== TOKEN OWNER ĐỂ TEST POSTMAN ===");
    console.log(token); // Hoặc tên biến chứa chuỗi JWT token của nhóm bạn
    return sendSuccess(res, 200, data, "Login successful. Welcome back!");
  } catch (err) {
    return next(err);
  }
}

async function logout(req, res) {
  return sendSuccess(res, 200, null, "Logged out successfully.");
}

async function forgotPassword(req, res, next) {
  try {
    const payload = validate(forgotPasswordSchema, req.body);
    const data = await authService.forgotPassword(payload);
    return sendSuccess(res, 200, data, "OTP has been generated.");
  } catch (err) {
    return next(err);
  }
}

async function verifyOtp(req, res, next) {
  try {
    const payload = validate(verifyOtpSchema, req.body);
    const data = await authService.verifyOtp(payload);
    return sendSuccess(res, 200, data, "OTP verified successfully.");
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
      "Your password has been reset successfully.",
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
      "Your password has been changed successfully.",
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
  staffLogin,
  verifyOtp,
};
