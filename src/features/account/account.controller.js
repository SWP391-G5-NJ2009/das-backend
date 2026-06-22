const accountService = require("./account.service");
const { sendSuccess } = require("../../utils/response");
const { validateCreateAccount, validateUpdateAccount } = require("./account.validator");

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

async function updateAccount(req, res, next) {
  try {
    const { id } = req.params;
    const payload = validateUpdateAccount(req.body);
    const data = await accountService.updateAccount(id, payload);
    return sendSuccess(res, 200, data, "Account updated successfully.");
  } catch (err) {
    return next(err);
  }
}

async function deleteAccount(req, res, next) {
  try {
    const { id } = req.params;
    const data = await accountService.deleteAccount(id);
    return sendSuccess(res, 200, data, "Account deleted successfully.");
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  createAccount,
  deleteAccount,
  getAllAccounts,
  updateAccount,
};
