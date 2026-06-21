const appointmentService = require("./appointment.service");
const { sendSuccess } = require("../../utils/response");
const {
  validateBookAppointment,
  validateCancelAppointment,
} = require("./appointment.validator");

/**
 * GET /api/appointments/my
 * Patient: fetch own appointments (filtered by JWT patientId).
 */
async function getMyAppointments(req, res, next) {
  try {
    const patientId = req.user.profileId;
    const filters = {
      status: req.query.status || null,
      date: req.query.date || null,
      month: req.query.month || null,
      year: req.query.year || null,
      search: req.query.search || null,
    };
    const data = await appointmentService.getMyAppointments(patientId, filters);
    return sendSuccess(res, 200, data, "Appointments fetched successfully.");
  } catch (err) {
    return next(err);
  }
}

/**
 * GET /api/appointments
 * Receptionist / Admin / Owner: fetch all clinic appointments.
 */
async function getAllAppointments(req, res, next) {
  try {
    const filters = {
      status: req.query.status || null,
      date: req.query.date || null,
      month: req.query.month || null,
      year: req.query.year || null,
      search: req.query.search || null,
    };
    const data = await appointmentService.getAll(filters);
    return sendSuccess(res, 200, data, "Appointments fetched successfully.");
  } catch (err) {
    return next(err);
  }
}

/**
 * PATCH /api/appointments/:id/cancel
 * Patient or Staff: cancel an appointment.
 */
async function cancelAppointment(req, res, next) {
  try {
    const apptId = parseInt(req.params.id, 10);
    const { reason } = validateCancelAppointment(req.body);
    const { id: actorAccountId, role, profileId } = req.user;

    const data = await appointmentService.cancelAppointment(
      apptId,
      actorAccountId,
      reason,
      role,
      profileId,
    );
    return sendSuccess(res, 200, data, "Appointment cancelled successfully.");
  } catch (err) {
    return next(err);
  }
}

/**
 * POST /api/appointments
 * Patient or Receptionist: create a new appointment.
 */
async function bookAppointment(req, res, next) {
  try {
    const { slotId, serviceId, note, patientId: bodyPatientId } =
      validateBookAppointment(req.body);
    const { role, profileId, id: actorAccountId } = req.user;

    // Patient always books for themselves; receptionist supplies patientId in body
    const patientId = role === "patient" ? profileId : bodyPatientId;

    if (!patientId) {
      return next(
        new (require("../../utils/AppError"))("patientId is required for receptionist bookings.", 400, "VALIDATION_ERROR"),
      );
    }

    const data = await appointmentService.bookAppointment({
      patientId: Number(patientId),
      slotId: Number(slotId),
      serviceId: Number(serviceId),
      note,
      actorAccountId,
      actorRole: role,
    });
    return sendSuccess(res, 201, data, "Appointment booked successfully.");
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  bookAppointment,
  cancelAppointment,
  getAllAppointments,
  getMyAppointments,
};
