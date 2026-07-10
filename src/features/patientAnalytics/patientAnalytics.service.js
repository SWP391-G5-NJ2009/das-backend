const patientAnalytics = require("./patientAnalytics.dao");

async function getNewPatient() {
    return patientAnalytics.getNewPatient();
}

async function getNoShowRate() {
    return patientAnalytics.getNoShowRate();
}

async function getReturningPatient() {
    return patientAnalytics.getReturningPatient();
}

async function getMonthlyNewPatient() {
    return patientAnalytics.getMonthlyNewPatient();
}

module.exports = {
    getNewPatient,
    getNoShowRate,
    getReturningPatient,
    getMonthlyNewPatient,
}