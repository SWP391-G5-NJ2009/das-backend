const Joi = require("joi");
const { validate } = require("../../utils/validation");

const createAccountSchema = Joi.object({
  username: Joi.string().trim().min(2).max(254).required().messages({
    "string.empty": "Tên người dùng không được để trống.",
    "string.min": "Tên người dùng cần ít nhất 2 kí tự.",
    "string.max": "Tên người dùng không được vượt quá 254 kí tự.",
    "any.required": "Tên người dùng là bắt buộc.",
  }),
  email: Joi.string().trim().email().max(254).allow("", null).messages({
    "string.max": "Email không được vượt quá 254 kí tự.",
  }),
  phone: Joi.string().trim().min(7).max(15).allow("", null).messages({
    "string.min": "Số điện thoại cần ít nhất 7 chữ số.",
    "string.max": "Số điện thoại không được vượt quá 15 chữ số.",
  }),
  password: Joi.string().trim().min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).+$/)
    .required().messages({
      "string.min": "Mật khẩu cần ít nhất 8 kí tự.",
      "string.pattern.base":
        "Mật khẩu cần có ít nhất 1 kí tự in hoa, 1 kí tự in thường, 1 chữ số và 1 kí tự đặc biệt.",
      "any.required": "Mật khẩu là bắt buộc.",
    }),
  role_name: Joi.string().trim().valid("Admin", "Dentist", "Receptionist", "Owner")
    .required().messages({
      "any.required": "Vai trò là bắt buộc.",
    }),
});

const updateAccountSchema = Joi.object({
  username: Joi.string().trim().min(2).max(100),
  email: Joi.string().email(),
  phone: Joi.string().trim().min(8).max(20),
  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).+$/)
    .messages({
      "string.min": "Password must be at least 8 characters.",
      "string.pattern.base":
        "Password must include uppercase, lowercase, a number, and a special character.",
    }),
  role_name: Joi.string()
    .valid("Admin", "Dentist", "Receptionist", "Owner", "Patient"),
  status: Joi.string().valid("Active", "Banned"),
});

function validateCreateAccount(payload) {
  return validate(createAccountSchema, payload);
}

function validateUpdateAccount(payload) {
  return validate(updateAccountSchema, payload);
}

module.exports = {
  validateCreateAccount,
  validateUpdateAccount,
};
