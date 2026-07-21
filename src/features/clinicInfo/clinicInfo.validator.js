const Joi = require("joi");
const { validate } = require("../../utils/validation");

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

const updateClinicInfoSchema = Joi.object({
  clinicName: Joi.string().trim().min(2).max(120).required(),
  address: Joi.string().trim().min(5).max(255).required(),
  hotline: Joi.string()
    .trim()
    .pattern(/^[0-9+() .-]{8,20}$/)
    .required()
    .messages({
      "string.pattern.base": "Số hotline không đúng định dạng.",
    }),
  openTime: Joi.string().pattern(TIME_PATTERN).required(),
  closeTime: Joi.string().pattern(TIME_PATTERN).required(),
}).custom((value, helpers) => {
  if (value.closeTime <= value.openTime) {
    return helpers.message("Giờ đóng cửa phải sau giờ mở cửa.");
  }

  return value;
});

function validateUpdateClinicInfo(payload) {
  return validate(updateClinicInfoSchema, payload);
}

module.exports = { validateUpdateClinicInfo };
