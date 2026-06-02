const accountService = require("../services/account.service")
const { sendSuccess } = require("../utils/response")
const { validateCreateAccount } = require("../validators/account.validator");


async function getAllAccounts(req, res, next) {
    try {
        const data = await accountService.getAllAccounts();
        return sendSuccess(res, 200, data, "Accounts retrieved successfully.");
    } catch (err) {
        return next(err);
    }
}

async function createAccount(req, res, next) {
    try {
        const payload = validateCreateAccount(req.body);
        const data = await accountService.createAccount(payload);
        return sendSuccess(res, 201, data, "Account created successfully.");
    } catch (err) {
        return next(err);
    }
}

module.exports = {
    getAllAccounts,
    createAccount
};