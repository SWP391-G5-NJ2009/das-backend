const appointmentDao = require("../features/appointment/appointment.dao");
const supabase = require("../config/supabase");
const logger = require("../utils/logger");

const INTERVAL_MS = 60 * 1000;

async function syncNoShowCounts() {
  // Step A: Count actual No-Show appointments per patient from DB
  const { data: noShowAppts, error: apptErr } = await supabase
    .from("appointment")
    .select("patient_id")
    .eq("status", "No-Show")
    .not("patient_id", "is", null);

  if (apptErr) {
    logger.error(
      "[noShowScheduler] syncNoShowCounts: Failed to fetch No-Show appointments:",
      apptErr.message,
    );
    return;
  }

  // Build actual count map: { patient_id -> count }
  const actualCount = {};
  for (const appt of noShowAppts || []) {
    actualCount[appt.patient_id] = (actualCount[appt.patient_id] || 0) + 1;
  }

  // Step B: Fetch all patients whose stored no_show_count differs from reality.
  const { data: patients, error: patientErr } = await supabase
    .from("patient")
    .select("patient_id, no_show_count")
    .gte("no_show_count", 0);

  if (patientErr) {
    logger.error(
      "[noShowScheduler] syncNoShowCounts: Failed to fetch patients:",
      patientErr.message,
    );
    return;
  }

  // Step C: Update any patient whose stored count differs from actual count
  for (const patient of patients || []) {
    const correct = actualCount[patient.patient_id] || 0;
    if (patient.no_show_count === correct) continue;

    const { error: writeErr } = await supabase
      .from("patient")
      .update({ no_show_count: correct })
      .eq("patient_id", patient.patient_id);

    if (writeErr) {
      logger.error(
        `[noShowScheduler] Failed to sync no_show_count for patient ${patient.patient_id}:`,
        writeErr.message,
      );
    } else {
      logger.info(
        `[noShowScheduler] Synced no_show_count for patient ${patient.patient_id}: ${patient.no_show_count} → ${correct}`,
      );
    }
  }
}

async function runNoShowSweep() {
  try {
    // Step 1: Mark overdue appointments as No-Show
    const updated = await appointmentDao.markOverdueAsNoShow();

    if (updated.length > 0) {
      logger.info(
        `[noShowScheduler] Marked ${updated.length} appointment(s) as No-Show.`,
      );
    }

    // Step 2: Sync no_show_count from actual appointment data
    await syncNoShowCounts();
  } catch (err) {
    // Never crash the server — just log
    logger.error(
      "[noShowScheduler] Unexpected error during sweep:",
      err.message,
    );
  }
}

function startNoShowScheduler() {
  logger.info(
    "[noShowScheduler] Started — checking every 60 s for overdue appointments.",
  );

  runNoShowSweep();
  return setInterval(runNoShowSweep, INTERVAL_MS);
}

module.exports = { startNoShowScheduler };
