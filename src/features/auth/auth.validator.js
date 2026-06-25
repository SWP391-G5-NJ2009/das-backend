const Joi = require("joi");
const { validate } = require("../../utils/validation");

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

const staffForgotPasswordSchema = Joi.object({
  username: Joi.string().trim().min(2).max(100).required(),
});

const accountIdSchema = Joi.alternatives().try(
  Joi.string().trim().min(1).max(100),
  Joi.number().integer().positive(),
);

const verifyOtpSchema = Joi.object({
  accountId: accountIdSchema,
  identifier: Joi.string().trim().min(2).max(100),
  otp: Joi.string().trim().length(6).pattern(/^\d+$/).required(),
}).or("accountId", "identifier");

const resetPasswordSchema = Joi.object({
  accountId: accountIdSchema,
  identifier: Joi.string().trim().min(2).max(100),
  otp: Joi.string().trim().length(6).pattern(/^\d+$/).required(),
  newPassword: Joi.string()
    .min(8)
    .pattern(/^(?=.*[A-Za-z])(?=.*\d).+$/)
    .required(),
}).or("accountId", "identifier");

const changePasswordSchema = Joi.object({
  oldPassword: Joi.string().required(),
  newPassword: Joi.string()
    .min(8)
    .pattern(/^(?=.*[A-Za-z])(?=.*\d).+$/)
    .required(),
});

module.exports = {
  changePasswordSchema,
  forgotPasswordSchema,
  patientLoginSchema,
  resetPasswordSchema,
  staffForgotPasswordSchema,
  staffLoginSchema,
  validate,
  verifyOtpSchema,
};
