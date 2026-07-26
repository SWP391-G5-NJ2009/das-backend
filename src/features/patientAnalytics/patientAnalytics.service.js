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

async function getMonthlyNewPatient(mCurrent, mOffset) {
    return patientAnalytics.getMonthlyNewPatient(mCurrent, mOffset);
}

async function getMonthlyReturningPatient() {
    return patientAnalytics.getMonthlyReturningPatient();
}

async function getMonthlyNoShowRate() {
    return patientAnalytics.getMonthlyNoShowRate();
}


module.exports = {
    getNewPatient,
    getNoShowRate,
    getReturningPatient,
    getMonthlyNewPatient,
    getMonthlyReturningPatient,
    getMonthlyNoShowRate,
}