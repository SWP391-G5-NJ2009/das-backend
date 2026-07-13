const appointmentService = require("./appointment.service");
const { sendSuccess } = require("../../utils/response");
const {
  validateBookAppointment,
  validateCancelAppointment,
} = require("./appointment.validator");

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

async function getAllAppointments(req, res, next) {
  try {
    const filters = {
      status: req.query.status || null,
      date: req.query.date || null,
      month: req.query.month || null,
      year: req.query.year || null,
      search: req.query.search || null,
      dentistId: req.user.role === "dentist" ? req.user.profileId : null,
    };
    const data = await appointmentService.getAll(filters);
    return sendSuccess(res, 200, data, "Appointments fetched successfully.");
  } catch (err) {
    return next(err);
  }
}

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

async function bookAppointment(req, res, next) {
  try {
    const {
      slotId,
      serviceId,
      note,
      patientId: bodyPatientId,
      newPatient,
      slotOccupied,
    } = validateBookAppointment(req.body);
    const { role, profileId, id: actorAccountId } = req.user;

    if (role === "receptionist" && !bodyPatientId && !newPatient) {
      return next(
        new (require("../../utils/AppError"))(
          "Either patientId or newPatient (fullName + phone) is required for receptionist bookings.",
          400,
          "VALIDATION_ERROR",
        ),
      );
    }

    const data = await appointmentService.bookAppointment({
      patientId:
        role === "patient"
          ? Number(profileId)
          : bodyPatientId
            ? Number(bodyPatientId)
            : null,
      newPatient: role === "receptionist" ? newPatient || null : null,
      slotId: Number(slotId),
      serviceId: Number(serviceId),
      note,
      actorAccountId,
      actorRole: role,
      slotOccupied: slotOccupied ?? 1,
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
