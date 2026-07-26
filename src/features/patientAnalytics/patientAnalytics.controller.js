const patientAnalytics = require("./patientAnalytics.service");
const { sendSuccess } = require("../../utils/response");

async function getNewPatient(req, res, next) {
    try {
        const data = await patientAnalytics.getNewPatient();
        return sendSuccess(res, 200, data, "Lấy số lượng bệnh nhân mới thành công.");
    } catch (err) {
        return next(err);
    }
}

async function getNoShowRate(req, res, next) {
    try {
        const data = await patientAnalytics.getNoShowRate();
        return sendSuccess(res, 200, data, "Lấy tỷ lệ vắng mặt thành công.");
    } catch (err) {
        return next(err);
    }
}

async function getReturningPatient(req, res, next) {
    try {
        const data = await patientAnalytics.getReturningPatient();
        return sendSuccess(res, 200, data, "Lấy số lượng bệnh nhân quay lại thành công.");
    } catch (err) {
        return next(err);
    }
}

async function getMonthlyNewPatient(req, res, next) {
    try {
        const today = new Date().toISOString().slice(0, 10);
        const m_current = req.query.m_current || today;
        const m_offset = parseInt(req.query.m_offset, 10) || 0;
        const data = await patientAnalytics.getMonthlyNewPatient(m_current, m_offset);
        return sendSuccess(res, 200, data, "Lấy số lượng bệnh nhân mới theo tháng thành công.");
    } catch (err) {
        return next(err);
    }
}

async function getMonthlyReturningPatient(req, res, next) {
    try {
        const data = await patientAnalytics.getMonthlyReturningPatient();
        return sendSuccess(res, 200, data, "Lấy số lượng bệnh nhân quay lại theo tháng thành công.");
    } catch (err) {
        return next(err);
    }
}

async function getMonthlyNoShowRate(req, res, next) {
    try {
        const data = await patientAnalytics.getMonthlyNoShowRate();
        return sendSuccess(res, 200, data, "Lấy tỷ lệ vắng mặt theo tháng thành công.");
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
    getMonthlyNoShowRate,
}