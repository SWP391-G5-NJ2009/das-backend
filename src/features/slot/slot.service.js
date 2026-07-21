const slotDao = require("./slot.dao");
const AppError = require("../../utils/AppError");

/**
 * Get slots for a dentist on a specific date.
 * Returns a normalized array ready for the frontend DateTimePicker.
 *
 * Returned shape: { id, time, timeEnd, status }
 * status values: "Available" | "Booked" | "Unavailable"
 */
async function getAvailableSlots(dentistId, date) {
  if (!dentistId || !date) {
    throw new AppError("Thiếu dentistId và ngày.", 400, "VALIDATION_ERROR");
  }

  const raw = await slotDao.findSlotsByDentistAndDate(Number(dentistId), date);

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
      // Pass status directly from DB — "Available" | "Booked" | "Unavailable"
      status: row.status,
    }))
    .sort((a, b) => (a.time || "").localeCompare(b.time || ""));
}

module.exports = { getAvailableSlots };
