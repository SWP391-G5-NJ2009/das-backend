const accountService = require("../services/account.service")
const { sendSuccess } = require("../utils/response")

async function getAllAccounts(req, res, next) {
    try {
        const data = await accountService.getAllAccounts();
        return sendSuccess(res, 200, data, "Accounts retrieved successfully.");
    } catch (err) {
        return next(err);
    }
}

module.exports = {
    getAllAccounts,
};