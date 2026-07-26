const Joi = require("joi");
const { validateDetails } = require("../../utils/validation");

const createConsultationSchema = Joi.object({
  full_name: Joi.string().trim().min(1).max(100).required().messages({
    "string.empty": "Họ và tên không được để trống.",
    "string.min": "Họ và tên phải có ít nhất 1 ký tự.",
    "string.max": "Họ và tên không được vượt quá 100 ký tự.",
    "any.required": "Họ và tên là bắt buộc.",
  }),
  phone: Joi.string().trim().pattern(/^[0-9]{10,11}$/).required().messages({
    "string.empty": "Số điện thoại không được để trống.", 
    "any.required": "Số điện thoại là bắt buộc.",
    "string.pattern.base": "Số điện thoại chỉ được chứa 10-11 chữ số.",

  }),
  email: Joi.string().trim().email().max(254).optional().allow("", null).messages({
    "string.max": "Email không được vượt quá 254 kí tự.",
    "string.email": "Email không hợp lệ.",
  }),
  description: Joi.string().trim().max(1000).optional().allow("", null).messages({
    "string.max": "Nội dung không được vượt quá 1000 kí tự.",
  }),
  service_id: Joi.number().integer().optional().allow(null, "").messages({
    "number.base": "Dịch vụ không hợp lệ.",
    "number.integer": "Dịch vụ không hợp lệ.",
  }),
  consultation_date: Joi.date().iso().optional().allow(null, "").messages({
    "date.base": "Ngày tư vấn không hợp lệ.",
    "date.format": "Ngày tư vấn phải có định dạng YYYY-MM-DD.",
  }),
  website: Joi.string().allow("").valid(""),
  loadedAt: Joi.number().optional(),
});

const updateConsultationSchema = Joi.object({
  status: Joi.string()
    .valid("Pending", "Booked", "Resolved", "Unreachable", "Closed")
    .required().messages({
    "any.required": "Trạng thái là bắt buộc.",
  }),
  note: Joi.string().trim().max(1000).allow("", null).messages({
    "string.max": "Nội dung không được vượt quá 1000 kí tự.",
  }),
});

function validateCreateConsultation(payload) {
  return validateDetails(createConsultationSchema, payload);
}

function validateUpdateConsultation(payload) {
  return validateDetails(updateConsultationSchema, payload);
}

module.exports = {
  validateCreateConsultation,
  validateUpdateConsultation,
};
