const appointmentService = require("./appointment.service");
const { sendSuccess } = require("../../utils/response");

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
    const { reason } = req.body;
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

module.exports = {
  cancelAppointment,
  getAllAppointments,
  getMyAppointments,
};
