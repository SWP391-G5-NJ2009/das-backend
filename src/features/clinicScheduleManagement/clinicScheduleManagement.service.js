const clinicScheduleManagementDao = require("./clinicScheduleManagement.dao");

async function getWorkingHour() {
    return clinicScheduleManagementDao.getWorkingHour();
}

module.exports = {
    getWorkingHour,
}