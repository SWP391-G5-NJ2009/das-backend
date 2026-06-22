const slotService = require("./slot.service");
const { sendSuccess } = require("../../utils/response");

/**
 * GET /api/slots?dentistId=&date=
 * Returns available slots for a dentist on a given date.
 */
async function getAvailableSlots(req, res, next) {
  try {
    const { dentistId, date } = req.query;
    const data = await slotService.getAvailableSlots(dentistId, date);
    return sendSuccess(res, 200, data, "Slots fetched successfully.");
  } catch (err) {
    return next(err);
  }
}

module.exports = { getAvailableSlots };
