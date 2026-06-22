const Joi = require("joi");
const { validate } = require("../../utils/validation");

const servicePayloadSchema = Joi.object({
  service_name: Joi.string().trim().min(2).max(150).required(),
  category_id: Joi.alternatives().try(Joi.number(), Joi.string()).required(),
  description: Joi.string().trim().max(2000).allow("", null),
  unit_price: Joi.number().min(0).required(),
  slot_occupied: Joi.number().integer().min(1).default(1),
  status: Joi.string().valid("Active", "Inactive").default("Inactive"),
});

function validateServicePayload(payload) {
  return validate(servicePayloadSchema, payload);
}

module.exports = { validateServicePayload };
