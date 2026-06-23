const supabase = require("../../config/supabase");
const AppError = require("../../utils/AppError");

/**
 * Fetch work_slots for a specific dentist on a given date.
 * Returns ALL slots (Available, Booked, Unavailable) so the UI can
 * show unavailable ones greyed-out.
 *
 * Joins: work_slot → schedules (by schedule_id) → time_slot_config (by slot_config_id)
 *
 * @param {number} dentistId
 * @param {string} date - ISO date string "YYYY-MM-DD"
 */
async function findSlotsByDentistAndDate(dentistId, date) {
  // Use `!inner` on both joined tables so PostgREST performs an INNER JOIN
  // and correctly applies the embedded filters (work_date, dentist_id).
  const { data, error } = await supabase
    .from("work_slot")
    .select(`
      slot_id,
      status,
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
    .eq("schedules.work_date", date)
    .eq("schedules.dentist_id", dentistId);

  if (error) throw new AppError(error.message, 500, "DB_ERROR");
  return data || [];
}

module.exports = { findSlotsByDentistAndDate };
