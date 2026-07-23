const Joi = require("joi");
const { validateDetails } = require("../../utils/validation");

const createAccountSchema = Joi.object({
  username: Joi.string().trim().min(2).max(100).required().messages({
    "string.empty": "Tên người dùng không được để trống.",
    "string.min": "Tên người dùng cần ít nhất 2 kí tự.",
    "string.max": "Tên người dùng không được vượt quá 100 kí tự.",
    "any.required": "Tên người dùng là bắt buộc.",
  }),
  email: Joi.string().trim().email().max(254).allow("", null).messages({
    "string.max": "Email không được vượt quá 254 kí tự.",
    "string.email": "Email không hợp lệ.",
  }),
  phone: Joi.string().trim().pattern(/^[0-9]{10,11}$/).allow("", null).messages({
    "string.pattern.base": "Số điện thoại chỉ được chứa 10-11 chữ số.",
  }),
  password: Joi.string().trim().min(8).max(72)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).+$/)
    .required().messages({
      "string.min": "Mật khẩu cần ít nhất 8 kí tự.",
      "string.max": "Mật khẩu không được vượt quá 72 chữ số.",
      "string.pattern.base":
        "Mật khẩu cần có ít nhất 1 kí tự in hoa, 1 kí tự in thường, 1 chữ số và 1 kí tự đặc biệt.",
      "any.required": "Mật khẩu là bắt buộc.",
    }),
  role_name: Joi.string().trim().valid("Admin", "Dentist", "Receptionist", "Owner", "Patient")
    .required().messages({
      "any.required": "Vai trò là bắt buộc.",
    }),
});

const updateAccountSchema = Joi.object({
  username: Joi.string().trim().min(2).max(100).required().messages({
    "string.empty": "Tên người dùng không được để trống.",
    "string.min": "Tên người dùng cần ít nhất 2 kí tự.",
    "string.max": "Tên người dùng không được vượt quá 100 kí tự.",
    "any.required": "Tên người dùng là bắt buộc.",
  }),
  email: Joi.string().email().max(254).allow("", null).messages({
    "string.max": "Email không được vượt quá 254 kí tự.",
    "string.email": "Email không hợp lệ.",
  }),
  phone: Joi.string().trim().pattern(/^[0-9]{10,11}$/).allow("", null).messages({
    "string.pattern.base": "Số điện thoại chỉ được chứa 10-11 chữ số.",
  }),
  password: Joi.string().trim().min(8).max(72).allow("", null)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).+$/)
    .messages({
      "string.min": "Mật khẩu cần ít nhất 8 kí tự.",
      "string.max": "Mật khẩu không được vượt quá 72 chữ số.",
      "string.pattern.base":
        "Mật khẩu cần có ít nhất 1 kí tự in hoa, 1 kí tự in thường, 1 chữ số và 1 kí tự đặc biệt.",
    }),
  role_name: Joi.string().trim().valid("Admin", "Dentist", "Receptionist", "Owner", "Patient")
    .required().messages({
      "any.required": "Vai trò là bắt buộc.",
    }),
  status: Joi.string().trim().valid("Active", "Deactivated").required().messages({
    "any.required": "Vai trò là bắt buộc.",
  }),
});

function validateCreateAccount(payload) {
  return validateDetails(createAccountSchema, payload);
}

function validateUpdateAccount(payload) {
  return validateDetails(updateAccountSchema, payload);
}

module.exports = {
  validateCreateAccount,
  validateUpdateAccount,
};
