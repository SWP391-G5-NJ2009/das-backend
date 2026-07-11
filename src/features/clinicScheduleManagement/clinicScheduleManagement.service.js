const clinicScheduleManagementDao = require("./clinicScheduleManagement.dao");

async function getWorkingHour() {
    return clinicScheduleManagementDao.getWorkingHour();
}

async function getClinicSetting() {
    return clinicScheduleManagementDao.getClinicSetting();
}

async function getClosures() {
    return clinicScheduleManagementDao.getClosures();
}

async function createClosure(closureDate, reason) {
    return clinicScheduleManagementDao.createClosure(closureDate, reason);
}

async function deleteClosure(closureId) {
    return clinicScheduleManagementDao.deleteClosure(closureId);
}

module.exports = {
    getWorkingHour,
    getClinicSetting,
    getClosures,
    createClosure,
    deleteClosure,
};