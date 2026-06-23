const Joi = require("joi");
const { validate } = require("../../utils/validation");

const updateMyProfileSchema = Joi.object({
  fullName: Joi.string().trim().min(1).max(100),
  email: Joi.string().trim().email().allow("", null),
  birthDate: Joi.date().iso().allow("", null),
  gender: Joi.string().trim().valid("Male", "Female", "").allow(null),
  address: Joi.string().trim().max(255).allow("", null),
}).min(1);

function validateUpdateMyProfile(payload) {
  return validate(updateMyProfileSchema, payload);
}

module.exports = {
  validateUpdateMyProfile,
};
