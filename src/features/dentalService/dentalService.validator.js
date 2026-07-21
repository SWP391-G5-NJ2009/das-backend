const Joi = require("joi");
const { validate } = require("../../utils/validation");

const servicePayloadSchema = Joi.object({
  service_name: Joi.string().trim().min(2).max(150).required().messages({
    "string.base": "Tên dịch vụ phải là chuỗi ký tự.",
    "string.empty": "Tên dịch vụ không được để trống.",
    "string.min": "Tên dịch vụ phải có ít nhất {#limit} ký tự.",
    "string.max": "Tên dịch vụ không được vượt quá {#limit} ký tự.",
    "any.required": "Tên dịch vụ là bắt buộc.",
  }),
  category_id: Joi.alternatives().try(Joi.number(), Joi.string()).required().messages({
    "any.required": "Danh mục dịch vụ là bắt buộc.",
    "alternatives.match": "Danh mục dịch vụ không hợp lệ.",
  }),
  description: Joi.string().trim().max(2000).allow("", null).messages({
    "string.max": "Mô tả không được vượt quá {#limit} ký tự.",
  }),
  unit_price: Joi.number().min(0).required().messages({
    "number.base": "Giá dịch vụ phải là số.",
    "number.min": "Giá dịch vụ không được âm.",
    "any.required": "Giá dịch vụ là bắt buộc.",
  }),
  slot_occupied: Joi.number().integer().min(1).default(1).messages({
    "number.base": "Số khung giờ phải là số nguyên.",
    "number.integer": "Số khung giờ phải là số nguyên.",
    "number.min": "Số khung giờ phải ít nhất là {#limit}.",
  }),
  status: Joi.string().valid("Active", "Inactive").default("Inactive").messages({
    "any.only": "Trạng thái chỉ được là 'Active' hoặc 'Inactive'.",
  }),
});

function validateServicePayload(payload) {
  return validate(servicePayloadSchema, payload);
}

module.exports = { validateServicePayload };
