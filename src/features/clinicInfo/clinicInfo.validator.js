const Joi = require("joi");
const { validate } = require("../../utils/validation");

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
});

function validateUpdateClinicInfo(payload) {
  return validate(updateClinicInfoSchema, payload);
}

module.exports = { validateUpdateClinicInfo };
