const Joi = require("joi");
const { validate } = require("../../utils/validation");

const roomPayloadSchema = Joi.object({
  room_name: Joi.string().trim().min(1).max(120).required(),
  specialization: Joi.string().trim().max(150).allow("", null),
  status: Joi.string()
    .trim()
    .valid("Available", "Maintenance", "Unavailable", "Active", "Inactive")
    .default("Available"),
});

function validateRoomPayload(payload) {
  return validate(roomPayloadSchema, payload);
}

module.exports = { validateRoomPayload };
