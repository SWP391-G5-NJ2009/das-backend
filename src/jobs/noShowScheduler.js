/**
 * noShowScheduler.js
 *
 * Background job that runs every minute.
 * Marks any "Confirmed" or "Waiting" appointment as "No-Show"
 * when the scheduled start time + 15-minute grace period has passed
 * and the appointment has not yet been checked in.
 *
 * Also increments `no_show_count` on the patient record via a
 * Supabase RPC `increment_no_show_count(p_patient_id uuid)`.
 */

const appointmentDao = require("../features/appointment/appointment.dao");
const logger = require("../utils/logger");

const INTERVAL_MS = 60 * 1000; // run every 60 seconds

async function runNoShowSweep() {
  try {
    const updated = await appointmentDao.markOverdueAsNoShow();

    if (updated.length === 0) return; // nothing to do

    logger.info(`[noShowScheduler] Marked ${updated.length} appointment(s) as No-Show.`);

    // Deduplicate patient IDs before incrementing
    const uniquePatientIds = [...new Set(updated.map((r) => r.patient_id).filter(Boolean))];
    await appointmentDao.incrementNoShowCount(uniquePatientIds);

    logger.info(
      `[noShowScheduler] Incremented no_show_count for ${uniquePatientIds.length} patient(s): ${uniquePatientIds.join(", ")}`,
    );
  } catch (err) {
    // Never crash the server — just log
    logger.error("[noShowScheduler] Unexpected error during sweep:", err.message);
  }
}

/**
 * Starts the No-Show scheduler.
 * Call once from server.js after the HTTP server starts listening.
 */
function startNoShowScheduler() {
  logger.info("[noShowScheduler] Started — checking every 60 s for overdue appointments.");

  // Run immediately on startup to catch any appointments that were missed
  // while the server was down, then repeat on the interval.
  runNoShowSweep();
  return setInterval(runNoShowSweep, INTERVAL_MS);
}

module.exports = { startNoShowScheduler };
