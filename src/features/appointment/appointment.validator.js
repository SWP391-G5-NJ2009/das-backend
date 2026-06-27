const Joi = require("joi");
const { validate } = require("../../utils/validation");

/* ──────────────────────────────────────────────────────────────────────────────
   POST /api/appointments  — book a new appointment
   Required by both patient (no patientId in body) and receptionist (patientId required).
   BR-14 timing checks are handled in the service layer after slot info is fetched from DB.
────────────────────────────────────────────────────────────────────────────── */
const bookAppointmentSchema = Joi.object({
  slotId: Joi.number().integer().positive().required().messages({
    "number.base": "slotId must be a number.",
    "number.integer": "slotId must be an integer.",
    "number.positive": "slotId must be a positive number.",
    "any.required": "slotId is required.",
  }),
  serviceId: Joi.number().integer().positive().required().messages({
    "number.base": "serviceId must be a number.",
    "number.integer": "serviceId must be an integer.",
    "number.positive": "serviceId must be a positive number.",
    "any.required": "serviceId is required.",
  }),
  // For receptionist booking an EXISTING patient
  patientId: Joi.number().integer().positive().allow(null).optional(),
  // For receptionist booking a WALK-IN patient (not yet in the system)
  newPatient: Joi.object({
    fullName: Joi.string().trim().min(2).max(100).required(),
    phone: Joi.string().trim().pattern(/^[0-9]{9,11}$/).required().messages({
      "string.pattern.base": "Phone must be 9–11 digits.",
    }),
  }).optional(),
  note: Joi.string().trim().max(2000).allow("", null).optional(),
  // Number of consecutive slots the selected service occupies (from dental_services.slot_occupied)
  slotOccupied: Joi.number().integer().min(1).allow(null).optional(),
});

/* ──────────────────────────────────────────────────────────────────────────────
   PATCH /api/appointments/:id/cancel  — cancel an existing appointment
────────────────────────────────────────────────────────────────────────────── */
const cancelAppointmentSchema = Joi.object({
  reason: Joi.string().trim().min(1).max(500).allow("", null).optional(),
});

function validateBookAppointment(payload) {
  return validate(bookAppointmentSchema, payload);
}

function validateCancelAppointment(payload) {
  return validate(cancelAppointmentSchema, payload);
}

module.exports = {
  validateBookAppointment,
  validateCancelAppointment,
};
