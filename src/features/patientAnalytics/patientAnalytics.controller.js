const patientAnalytics = require("./patientAnalytics.service");
const { sendSuccess } = require("../../utils/response");

async function getNewPatient(req, res, next) {
    try {
        const data = await patientAnalytics.getNewPatient();
        return sendSuccess(res, 200, data, "New patient count retrieved successfully.");
    } catch (err) {
        return next(err);
    }
}

async function getNoShowRate(req, res, next) {
    try {
        const data = await patientAnalytics.getNoShowRate();
        return sendSuccess(res, 200, data, "No-show rate retrieved successfully.");
    } catch (err) {
        return next(err);
    }
}

async function getReturningPatient(req, res, next) {
    try {
        const data = await patientAnalytics.getReturningPatient();
        return sendSuccess(res, 200, data, "Returning patient count retrieved successfully.");
    } catch (err) {
        return next(err);
    }
}

async function getMonthlyNewPatient(req, res, next) {
    try {
        const data = await patientAnalytics.getMonthlyNewPatient();
        return sendSuccess(res, 200, data, "Monthly new patient count retrieved successfully.");
    } catch (err) {
        return next(err);
    }
}

async function getMonthlyReturningPatient(req, res, next) {
    try {
        const data = await patientAnalytics.getMonthlyReturningPatient();
        return sendSuccess(res, 200, data, "Monthly returning patient count retrieved successfully.");
    } catch (err) {
        return next(err);
    }
}

module.exports = {
    getNewPatient,
    getNoShowRate,
    getReturningPatient,
    getMonthlyNewPatient,
    getMonthlyReturningPatient,
}