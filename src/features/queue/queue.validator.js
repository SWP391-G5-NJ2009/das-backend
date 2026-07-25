const Joi = require("joi");
const { validate } = require("../../utils/validation");

const createFollowUpSchema = Joi.object({
  scheduledFor: Joi.date().iso().greater("now").required(),
  reason: Joi.string().trim().min(2).max(500).required(),
});

const createWalkInSchema = Joi.object({
  patientId: Joi.number().integer().positive().required(),
  dentistId: Joi.number().integer().positive().required(),
  note: Joi.string().trim().max(1000).allow("", null).optional(),
});

const updateStatusSchema = Joi.object({
  status: Joi.string().valid("IN_PROGRESS", "COMPLETED", "CANCELLED").required(),
});

function validateCreateFollowUp(payload) {
  return validate(createFollowUpSchema, payload);
}

function validateCreateWalkIn(payload) {
  return validate(createWalkInSchema, payload);
}

function validateUpdateStatus(payload) {
  return validate(updateStatusSchema, payload);
}

module.exports = {
  validateCreateFollowUp,
  validateCreateWalkIn,
  validateUpdateStatus,
};
