const Joi = require("joi");

const patientLoginSchema = Joi.object({
  phone: Joi.string().trim().min(8).max(20).required(),
  password: Joi.string().required(),
});

const staffLoginSchema = Joi.object({
  username: Joi.string().trim().min(2).max(100).required(),
  password: Joi.string().required(),
});

const forgotPasswordSchema = Joi.object({
  identifier: Joi.string().trim().min(2).max(100).required(),
});

const verifyOtpSchema = Joi.object({
  identifier: Joi.string().trim().min(2).max(100).required(),
  otp: Joi.string().trim().length(6).pattern(/^\d+$/).required(),
});

const resetPasswordSchema = Joi.object({
  identifier: Joi.string().trim().min(2).max(100).required(),
  otp: Joi.string().trim().length(6).pattern(/^\d+$/).required(),
  newPassword: Joi.string()
    .min(8)
    .pattern(/^(?=.*[A-Za-z])(?=.*\d).+$/)
    .required(),
});

const changePasswordSchema = Joi.object({
  oldPassword: Joi.string().required(),
  newPassword: Joi.string()
    .min(8)
    .pattern(/^(?=.*[A-Za-z])(?=.*\d).+$/)
    .required(),
});

function validate(schema, payload) {
  const { error, value } = schema.validate(payload, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    error.statusCode = 400;
    error.code = "VALIDATION_ERROR";
    error.isOperational = true;
    throw error;
  }

  return value;
}

module.exports = {
  changePasswordSchema,
  forgotPasswordSchema,
  patientLoginSchema,
  resetPasswordSchema,
  staffLoginSchema,
  validate,
  verifyOtpSchema,
};
