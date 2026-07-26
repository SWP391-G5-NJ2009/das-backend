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

async function getMonthlyReturningPatient(mCurrent, mOffset) {
    return patientAnalytics.getMonthlyReturningPatient(mCurrent, mOffset);
}

async function getMonthlyNoShowRate(mCurrent, mOffset) {
    return patientAnalytics.getMonthlyNoShowRate(mCurrent, mOffset);
}


module.exports = {
    getNewPatient,
    getNoShowRate,
    getReturningPatient,
    getMonthlyNewPatient,
    getMonthlyReturningPatient,
    getMonthlyNoShowRate,
}