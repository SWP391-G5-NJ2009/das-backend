const Joi = require("joi");
const { validate } = require("../../utils/validation");

const createDentistProfileSchema = Joi.object({
  accountId: Joi.string().guid({ version: ["uuidv4", "uuidv5"] }).required(),
  fullName: Joi.string().trim().min(2).max(100).required(),
  birthDate: Joi.date().iso().max("now").required(),
  gender: Joi.string().trim().valid("Male", "Female").required(),
  address: Joi.string().trim().min(1).max(255).required(),
  speciality: Joi.string().trim().min(1).max(150).required(),
  experience: Joi.string().trim().min(1).max(255).required(),
});

function validateCreateDentistProfile(payload) {
  return validate(createDentistProfileSchema, payload);
}

module.exports = { validateCreateDentistProfile };
