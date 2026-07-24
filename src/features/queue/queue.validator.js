const Joi = require("joi");
const { validate } = require("../../utils/validation");

const createFollowUpSchema = Joi.object({
  scheduledFor: Joi.date().iso().greater("now").required(),
  reason: Joi.string().trim().min(2).max(500).required(),
});

function validateCreateFollowUp(payload) {
  return validate(createFollowUpSchema, payload);
}

module.exports = { validateCreateFollowUp };
