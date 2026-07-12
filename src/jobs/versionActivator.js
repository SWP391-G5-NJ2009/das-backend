const clinicScheduleManagementService = require("../features/clinicScheduleManagement/clinicScheduleManagement.service");
const logger = require("../utils/logger");

const INTERVAL_MS = 60 * 60 * 1000; // run every hour

async function runVersionActivation() {
    try {
        const activated = await clinicScheduleManagementService.activateDueVersions();
        if (activated > 0) {
            logger.info(`[versionActivator] Activated ${activated} version(s).`);
        }
    } catch (err) {
        logger.error("[versionActivator] Unexpected error during activation sweep:", err.message);
    }
}

function startVersionActivator() {
    logger.info("[versionActivator] Started — checking every hour for due versions.");

    // Run immediately on startup to catch versions that became due while server was down
    runVersionActivation();
    return setInterval(runVersionActivation, INTERVAL_MS);
}

module.exports = { startVersionActivator };
