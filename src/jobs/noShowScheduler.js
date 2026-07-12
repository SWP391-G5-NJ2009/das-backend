/**
 * noShowScheduler.js
 *
 * Background job that runs every minute.
 * Marks any "Confirmed" appointment as "No-Show" when the scheduled start
 * time + 15-minute grace period has passed and the patient has not checked in.
 *
 * Also increments `no_show_count` on the patient record, and sets
 * `account.status = 'Restricted'` once a patient reaches 3+ no-shows.
 *
 * The restriction sweep runs independently every cycle — it does NOT depend
 * on new No-Shows being found in the same cycle. This ensures patients who
 * accumulated 3 no-shows across separate runs are still caught and restricted.
 */

const appointmentDao = require("../features/appointment/appointment.dao");
const supabase = require("../config/supabase");
const logger = require("../utils/logger");

const INTERVAL_MS = 60 * 1000; // run every 60 seconds
const BAN_THRESHOLD = 3;

/**
 * Independent sweep: find ALL patients with no_show_count >= threshold who have
 * an account, then set those accounts to Restricted.
 *
 * NOTE: We intentionally do NOT filter by account.status here.
 * - Filtering on joined tables via .eq("account.status", ...) is unreliable in Supabase JS.
 * - Updating Restricted → Restricted is a safe no-op.
 * - This makes the function idempotent and self-healing.
 */
async function syncRestrictedAccounts() {
  // Step 1: Fetch all patients who crossed the ban threshold and have an account
  const { data: bannedPatients, error: fetchError } = await supabase
    .from("patient")
    .select("patient_id, account_id, no_show_count")
    .gte("no_show_count", BAN_THRESHOLD)
    .not("account_id", "is", null);

  if (fetchError) {
    logger.error("[noShowScheduler] Failed to query banned patients:", fetchError.message);
    return;
  }

  if (!bannedPatients || bannedPatients.length === 0) {
    logger.info("[noShowScheduler] syncRestrictedAccounts: No patients above ban threshold.");
    return;
  }

  logger.info(
    `[noShowScheduler] syncRestrictedAccounts: Found ${bannedPatients.length} patient(s) with no_show_count >= ${BAN_THRESHOLD}.`,
    bannedPatients.map((p) => `patient_id=${p.patient_id} no_show_count=${p.no_show_count}`),
  );

  const accountIds = bannedPatients.map((p) => p.account_id).filter(Boolean);

  // Step 2: Bulk update to Restricted (idempotent — safe to run on already-restricted accounts)
  const { error: updateError } = await supabase
    .from("account")
    .update({ status: "Restricted" })
    .in("account_id", accountIds);

  if (updateError) {
    logger.error("[noShowScheduler] Failed to restrict accounts:", updateError.message);
    return;
  }

  logger.info(
    `[noShowScheduler] Set ${accountIds.length} account(s) to Restricted (ban threshold reached).`,
  );
}

/**
 * Sync no_show_count from the actual appointment table.
 * Counts all current "No-Show" appointments per patient and updates the counter.
 * Fixes cases where no_show_count is stale (e.g., appointments set manually in DB).
 */
async function syncNoShowCounts() {
  // Fetch all appointments with status "No-Show"
  const { data: noShowAppts, error } = await supabase
    .from("appointment")
    .select("patient_id")
    .eq("status", "No-Show")
    .not("patient_id", "is", null);

  if (error) {
    logger.error("[noShowScheduler] syncNoShowCounts: Failed to fetch No-Show appointments:", error.message);
    return;
  }

  if (!noShowAppts || noShowAppts.length === 0) return;

  // Count per patient_id
  const countByPatient = {};
  for (const appt of noShowAppts) {
    countByPatient[appt.patient_id] = (countByPatient[appt.patient_id] || 0) + 1;
  }

  // Update each patient's no_show_count to match actual appointment count
  for (const [patientId, count] of Object.entries(countByPatient)) {
    const { data: current, error: readErr } = await supabase
      .from("patient")
      .select("no_show_count")
      .eq("patient_id", patientId)
      .single();

    if (readErr || !current) continue;

    // Only update if the stored value is wrong (avoid unnecessary writes)
    if (current.no_show_count !== count) {
      const { error: writeErr } = await supabase
        .from("patient")
        .update({ no_show_count: count })
        .eq("patient_id", patientId);

      if (writeErr) {
        logger.error(`[noShowScheduler] Failed to sync no_show_count for patient ${patientId}:`, writeErr.message);
      } else {
        logger.info(`[noShowScheduler] Synced no_show_count for patient ${patientId}: ${current.no_show_count} → ${count}`);
      }
    }
  }
}

async function runNoShowSweep() {
  try {
    // ── Step 1: Sync no_show_count from actual appointments ────────────────────
    // Fixes stale counters (e.g., when appointments were set to No-Show manually).
    await syncNoShowCounts();

    // ── Step 2: Mark overdue appointments as No-Show ───────────────────────────
    const updated = await appointmentDao.markOverdueAsNoShow();

    if (updated.length > 0) {
      logger.info(`[noShowScheduler] Marked ${updated.length} appointment(s) as No-Show.`);

      const uniquePatientIds = [
        ...new Set(updated.map((r) => r.patient_id).filter(Boolean)),
      ];
      await appointmentDao.incrementNoShowCount(uniquePatientIds);

      logger.info(
        `[noShowScheduler] Incremented no_show_count for ${uniquePatientIds.length} patient(s): ${uniquePatientIds.join(", ")}`,
      );
    }

    // ── Step 3: Restrict accounts for all patients above the ban threshold ──────
    await syncRestrictedAccounts();
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

  runNoShowSweep();
  return setInterval(runNoShowSweep, INTERVAL_MS);
}

module.exports = { startNoShowScheduler };
