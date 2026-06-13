const Joi = require("joi");
const { validate } = require("../../utils/validation");

const createAccountSchema = Joi.object({
  username: Joi.string().trim().min(2).max(100).required(),
  email: Joi.string().email().required(),
  phone: Joi.string().trim().min(8).max(20).required(),
  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).+$/)
    .required()
    .messages({
      "string.min": "Password must be at least 8 characters.",
      "string.pattern.base":
        "Password must include uppercase, lowercase, a number, and a special character.",
    }),
  role_name: Joi.string()
    .valid("Admin", "Dentist", "Receptionist", "Owner", "Patient")
    .required(),
  status: Joi.string().valid("Active", "Banned").default("Active"),
});

const updateAccountSchema = Joi.object({
  username: Joi.string().trim().min(2).max(100),
  email: Joi.string().email(),
  phone: Joi.string().trim().min(8).max(20),
  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[!@#$%^&*]).+$/)
    .messages({
      "string.min": "Password must be at least 8 characters.",
      "string.pattern.base":
        "Password must include uppercase, lowercase, a number, and a special character.",
    }),
  role_name: Joi.string()
    .valid("Admin", "Dentist", "Receptionist", "Owner", "Patient"),
  status: Joi.string().valid("Active", "Banned"),
});

function validateCreateAccount(payload) {
  return validate(createAccountSchema, payload);
}

function validateUpdateAccount(payload) {
  return validate(updateAccountSchema, payload);
}

module.exports = {
  validateCreateAccount,
  validateUpdateAccount,
};
