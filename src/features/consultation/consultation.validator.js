const Joi = require("joi");
const { validate } = require("../../utils/validation");

const createConsultationSchema = Joi.object({
  full_name: Joi.string().trim().min(2).max(100).required(),
  phone: Joi.string().trim().min(8).max(20).required(),
  email: Joi.string().trim().email().allow("", null),
  description: Joi.string().trim().min(1).max(2000).required(),
});

const updateConsultationSchema = Joi.object({
  status: Joi.string()
    .valid("Pending", "Solved", "Spam", "Fail-to-contact", "Other")
    .required(),
  note: Joi.string().trim().max(2000).allow("", null),
});

function validateCreateConsultation(payload) {
  return validate(createConsultationSchema, payload);
}

function validateUpdateConsultation(payload) {
  return validate(updateConsultationSchema, payload);
}

module.exports = {
  validateCreateConsultation,
  validateUpdateConsultation,
};
