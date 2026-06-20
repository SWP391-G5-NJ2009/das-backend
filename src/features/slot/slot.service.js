const slotDao = require("./slot.dao");
const AppError = require("../../utils/AppError");

/**
 * Get available slots for a dentist on a specific date.
 * Returns a normalized array ready for the frontend DateTimePicker.
 *
 * Returned shape: { id, time, timeEnd, status }
 */
async function getAvailableSlots(dentistId, date) {
  if (!dentistId || !date) {
    throw new AppError("dentistId and date are required.", 400, "VALIDATION_ERROR");
  }

  const raw = await slotDao.findAvailableSlots(Number(dentistId), date);

  // Only include rows where the schedule join matched (not null)
  return raw
    .filter((row) => row.schedules !== null)
    .map((row) => ({
      id: String(row.slot_id),
      time: row.time_slot_config?.start_time
        ? row.time_slot_config.start_time.substring(0, 5)
        : null,
      timeEnd: row.time_slot_config?.end_time
        ? row.time_slot_config.end_time.substring(0, 5)
        : null,
      // Map DB boolean → UI status string
      status: row.is_available ? "available" : "booked",
    }))
    .sort((a, b) => (a.time || "").localeCompare(b.time || ""));
}

module.exports = { getAvailableSlots };
