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

const createStaffProfileSchema = Joi.object({
  role: Joi.string().valid("dentist", "receptionist").required(),
  accountId: Joi.string().guid({ version: ["uuidv4", "uuidv5"] }).required(),
  fullName: Joi.string().trim().min(2).max(100).required(),
  birthDate: Joi.date().iso().max("now").required(),
  gender: Joi.string().trim().valid("Male", "Female").required(),
  address: Joi.string().trim().min(1).max(255).required(),
  speciality: Joi.when("role", { is: "dentist", then: Joi.string().trim().min(1).max(150).required(), otherwise: Joi.forbidden() }),
  experience: Joi.when("role", { is: "dentist", then: Joi.string().trim().min(1).max(255).required(), otherwise: Joi.forbidden() }),
});

const updateDentistProfileSchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(100).required(),
  birthDate: Joi.date().iso().max("now").required(),
  gender: Joi.string().trim().valid("Male", "Female").required(),
  address: Joi.string().trim().min(1).max(255).required(),
  speciality: Joi.string().trim().min(1).max(150).required(),
  experience: Joi.string().trim().min(1).max(255).required(),
  serviceIds: Joi.array().items(Joi.string().trim().required()).unique().required(),
});

const updateReceptionistProfileSchema = Joi.object({
  fullName: Joi.string().trim().min(2).max(100).required(),
  birthDate: Joi.date().iso().max("now").required(),
  gender: Joi.string().trim().valid("Male", "Female").required(),
  address: Joi.string().trim().min(1).max(255).required(),
});

function validateCreateDentistProfile(payload) {
  return validate(createDentistProfileSchema, payload);
}

function validateUpdateDentistProfile(payload) {
  return validate(updateDentistProfileSchema, payload);
}

function validateUpdateReceptionistProfile(payload) {
  return validate(updateReceptionistProfileSchema, payload);
}

function validateCreateStaffProfile(payload) {
  return validate(createStaffProfileSchema, payload);
}

module.exports = {
  validateCreateDentistProfile,
  validateCreateStaffProfile,
  validateUpdateDentistProfile,
  validateUpdateReceptionistProfile,
};
