const supabase = require("../../config/supabase");
const AppError = require("../../utils/AppError");

function ensureSupabase() {
  if (!supabase) {
    throw new AppError("Supabase is not configured.", 500, "SUPABASE_NOT_CONFIGURED");
  }
}

/**
 * Fetch available work_slots for a specific dentist on a given date.
 * Joins: work_slot → schedules (by schedule_id) → time_slot_config (by slot_config_id)
 *
 * @param {number} dentistId
 * @param {string} date - ISO date string "YYYY-MM-DD"
 */
async function findAvailableSlots(dentistId, date) {
  ensureSupabase();

  // Use `!inner` on both joined tables so PostgREST performs an INNER JOIN
  // and correctly applies the embedded filters (work_date, dentist_id).
  // Without `!inner`, .eq() on related table columns is silently ignored.
  const { data, error } = await supabase
    .from("work_slot")
    .select(`
      slot_id,
      is_available,
      time_slot_config:slot_config_id!inner (
        slot_config_id,
        start_time,
        end_time
      ),
      schedules:schedule_id!inner (
        schedule_id,
        work_date,
        dentist_id
      )
    `)
    // Return ALL slots (available + booked) so the UI can show booked ones as grayed-out
    .eq("schedules.work_date", date)
    .eq("schedules.dentist_id", dentistId);

  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  return data || [];
}

module.exports = { findAvailableSlots };
