const Joi = require("joi");
const { validate } = require("../../utils/validation");

const updateMyProfileSchema = Joi.object({
  fullName: Joi.string().trim().min(1).max(100),
  email: Joi.string().trim().email().allow("", null),
  phone: Joi.string().trim().min(8).max(20).allow("", null),
  birthDate: Joi.date().iso().allow("", null),
  gender: Joi.string().trim().valid("Male", "Female", "").allow(null),
  address: Joi.string().trim().max(255).allow("", null),
  speciality: Joi.string().trim().max(100).allow("", null),
}).min(1);

function validateUpdateMyProfile(payload) {
  return validate(updateMyProfileSchema, payload);
}

module.exports = {
  validateUpdateMyProfile,
};
