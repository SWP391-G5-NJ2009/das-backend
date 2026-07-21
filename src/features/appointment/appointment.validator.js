const Joi = require("joi");
const { validate } = require("../../utils/validation");

/* ──────────────────────────────────────────────────────────────────────────────
   POST /api/appointments  — book a new appointment
   Required by both patient (no patientId in body) and receptionist (patientId required).
   BR-14 timing checks are handled in the service layer after slot info is fetched from DB.
────────────────────────────────────────────────────────────────────────────── */
const bookAppointmentSchema = Joi.object({
  slotId: Joi.number().integer().positive().required().messages({
    "number.base": "slotId phải là số.",
    "number.integer": "slotId phải là số nguyên.",
    "number.positive": "slotId phải là số dương.",
    "any.required": "slotId là bắt buộc.",
  }),
  serviceId: Joi.number().integer().positive().required().messages({
    "number.base": "serviceId phải là số.",
    "number.integer": "serviceId phải là số nguyên.",
    "number.positive": "serviceId phải là số dương.",
    "any.required": "serviceId là bắt buộc.",
  }),
  // For receptionist booking an EXISTING patient
  patientId: Joi.number().integer().positive().allow(null).optional(),
  // For receptionist booking a WALK-IN patient (not yet in the system)
  newPatient: Joi.object({
    fullName: Joi.string().trim().min(2).max(100).required().messages({
      "string.base": "Họ tên bệnh nhân phải là chuỗi ký tự.",
      "string.empty": "Họ tên bệnh nhân không được để trống.",
      "string.min": "Họ tên bệnh nhân phải có ít nhất {#limit} ký tự.",
      "string.max": "Họ tên bệnh nhân không được vượt quá {#limit} ký tự.",
      "any.required": "Họ tên bệnh nhân là bắt buộc.",
    }),
    phone: Joi.string().trim().pattern(/^[0-9]{9,11}$/).required().messages({
      "string.pattern.base": "Số điện thoại phải có từ 9 đến 11 chữ số.",
      "string.empty": "Số điện thoại không được để trống.",
      "any.required": "Số điện thoại là bắt buộc.",
    }),
  }).optional(),
  note: Joi.string().trim().max(2000).allow("", null).optional().messages({
    "string.max": "Ghi chú không được vượt quá {#limit} ký tự.",
  }),
  // Number of consecutive slots the selected service occupies (from dental_services.slot_occupied)
  slotOccupied: Joi.number().integer().min(1).allow(null).optional(),
  // ID of the consultation request that triggered this booking (receptionist flow only)
  consultationRequestId: Joi.number().integer().positive().allow(null).optional(),
});

/* ──────────────────────────────────────────────────────────────────────────────
   PATCH /api/appointments/:id/cancel  — cancel an existing appointment
────────────────────────────────────────────────────────────────────────────── */
const cancelAppointmentSchema = Joi.object({
  reason: Joi.string().trim().min(1).max(500).allow("", null).optional().messages({
    "string.max": "Lý do hủy không được vượt quá {#limit} ký tự.",
  }),
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
