const appointmentDao = require("../features/appointment/appointment.dao");
const logger = require("../utils/logger");

const INTERVAL_MS = 60 * 1000;

async function runNoShowSweep() {
  try {
    const updated = await appointmentDao.markOverdueAsNoShow();

    if (updated.length === 0) return;

    logger.info(`[noShowScheduler] Marked ${updated.length} appointment(s) as No-Show.`);

    const uniquePatientIds = [...new Set(updated.map((r) => r.patient_id).filter(Boolean))];
    await appointmentDao.incrementNoShowCount(uniquePatientIds);

    logger.info(
      `[noShowScheduler] Incremented no_show_count for ${uniquePatientIds.length} patient(s): ${uniquePatientIds.join(", ")}`,
    );
  } catch (err) {
    logger.error("[noShowScheduler] Unexpected error during sweep:", err.message);
  }
}

function startNoShowScheduler() {
  logger.info("[noShowScheduler] Started — checking every 60 s for overdue appointments.");
  runNoShowSweep();
  return setInterval(runNoShowSweep, INTERVAL_MS);
}

module.exports = { startNoShowScheduler };
