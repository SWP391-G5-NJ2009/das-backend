const Joi = require("joi");
const { validate } = require("../../utils/validation");

const createPatientAccountSchema = Joi.object({
  fullName: Joi.string().trim().min(1).max(100).required(),
  phone: Joi.string().trim().min(8).max(20).required(),
  birthDate: Joi.date().iso().allow("", null),
  gender: Joi.string().trim().valid("Male", "Female", "Other", "").allow(null),
  address: Joi.string().trim().max(255).allow("", null),
  password: Joi.string().min(8).max(72).required(),
});

function validateCreatePatientAccount(payload) {
  return validate(createPatientAccountSchema, payload);
}

module.exports = {
  validateCreatePatientAccount,
};
