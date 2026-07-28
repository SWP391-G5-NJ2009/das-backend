const Joi = require("joi");
const { validate } = require("../../utils/validation");

const createFollowUpSchema = Joi.object({
  scheduledFor: Joi.date().iso().greater("now").required(),
  reason: Joi.string().trim().min(2).max(500).required(),
});

const createWalkInSchema = Joi.object({
  patientId: Joi.number().integer().positive().required(),
  serviceId: Joi.number().integer().positive().required(),
  dentistId: Joi.number().integer().positive().required(),
  note: Joi.string().trim().max(1000).allow("", null).optional(),
}).unknown(false);

const updateStatusSchema = Joi.object({
  status: Joi.string().valid("IN_PROGRESS", "COMPLETED", "CANCELLED").required(),
});

const recordWalkInTreatmentSchema = Joi.object({
  clinicalExamination: Joi.string().trim().max(2000).allow("", null).optional(),
  diagnosis: Joi.string().trim().min(1).max(1000).required(),
  treatmentNote: Joi.string().trim().min(1).max(2000).required(),
  postTreatmentInstructions: Joi.string().trim().max(2000).allow("", null).optional(),
  completePlan: Joi.any().strip(),
}).unknown(false);

function validateCreateFollowUp(payload) {
  return validate(createFollowUpSchema, payload);
}

function validateCreateWalkIn(payload) {
  return validate(createWalkInSchema, payload);
}

function validateUpdateStatus(payload) {
  return validate(updateStatusSchema, payload);
}

function validateRecordWalkInTreatment(payload) {
  return validate(recordWalkInTreatmentSchema, payload);
}

module.exports = {
  validateCreateFollowUp,
  validateCreateWalkIn,
  validateRecordWalkInTreatment,
  validateUpdateStatus,
};
