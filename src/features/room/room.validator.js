const Joi = require("joi");
const { validate } = require("../../utils/validation");

const roomPayloadSchema = Joi.object({
  room_name: Joi.string().trim().min(1).max(120).required(),
  dentist_id: Joi.number().integer().positive().allow(null),
  status: Joi.string()
    .trim()
    .valid("Available", "Unavailable", "Occupied")
    .default("Available"),
});

function validateRoomPayload(payload) {
  return validate(roomPayloadSchema, payload);
}

module.exports = { validateRoomPayload };
