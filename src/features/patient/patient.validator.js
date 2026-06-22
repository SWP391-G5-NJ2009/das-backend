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

const updateMyProfileSchema = Joi.object({
  fullName: Joi.string().trim().min(1).max(100),
  email: Joi.string().trim().email().allow("", null),
  phone: Joi.string().trim().min(8).max(20),
  birthDate: Joi.date().iso().allow("", null),
  gender: Joi.string().trim().max(20).allow("", null),
  address: Joi.string().trim().max(255).allow("", null),
}).min(1);

function validateCreatePatientAccount(payload) {
  return validate(createPatientAccountSchema, payload);
}

function validateUpdateMyProfile(payload) {
  return validate(updateMyProfileSchema, payload);
}

module.exports = {
  validateCreatePatientAccount,
  validateUpdateMyProfile,
};
