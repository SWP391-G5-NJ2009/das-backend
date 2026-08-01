const appointmentDao = require("../features/appointment/appointment.dao");
const supabase = require("../config/supabase");

const INTERVAL_MS = 60 * 1000;

async function syncNoShowCounts() {
  const { data: noShowAppts, error: apptErr } = await supabase
    .from("appointment")
    .select("patient_id")
    .eq("status", "No-Show")
    .not("patient_id", "is", null);

  if (apptErr) return;

  const actualCount = {};
  for (const appt of noShowAppts || []) {
    actualCount[appt.patient_id] = (actualCount[appt.patient_id] || 0) + 1;
  }

  const { data: patients, error: patientErr } = await supabase
    .from("patient")
    .select("patient_id, no_show_count")
    .gte("no_show_count", 0);

  if (patientErr) return;

  for (const patient of patients || []) {
    const correct = actualCount[patient.patient_id] || 0;
    if (patient.no_show_count === correct) continue;

    await supabase
      .from("patient")
      .update({ no_show_count: correct })
      .eq("patient_id", patient.patient_id);
  }
}

async function runNoShowSweep() {
  try {
    await appointmentDao.markOverdueAsNoShow();
    await syncNoShowCounts();
  } catch {
    // Keep the background job from crashing the server.
  }
}

function startNoShowScheduler() {
  runNoShowSweep();
  return setInterval(runNoShowSweep, INTERVAL_MS);
}

module.exports = { startNoShowScheduler };
