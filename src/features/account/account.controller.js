const accountService = require("./account.service");
const { sendSuccess } = require("../../utils/response");
const { validateCreateAccount, validateUpdateAccount } = require("./account.validator");

async function getAllAccounts(req, res, next) {
  try {
    const filters = {
      role: req.query.role || null,
      status: req.query.status || null,
      from_date: req.query.from_date || null,
      to_date: req.query.to_date || null,
      search: req.query.search || null,
      pagination: req.query.pagination || null,
    };
    const data = await accountService.getAllAccounts(filters);
    return sendSuccess(res, 200, data, "Lấy danh sách tài khoản thành công.");
  } catch (err) {
    return next(err);
  }
}

async function createAccount(req, res, next) {
  try {
    const payload = validateCreateAccount(req.body);
    const data = await accountService.createAccount(payload);
    return sendSuccess(res, 201, data, "Tạo tài khoản thành công.");
  } catch (err) {
    return next(err);
  }
}

async function updateAccount(req, res, next) {
  try {
    const { id } = req.params;
    const payload = validateUpdateAccount(req.body);
    const data = await accountService.updateAccount(id, payload);
    return sendSuccess(res, 200, data, "Cập nhật tài khoản thành công.");
  } catch (err) {
    return next(err);
  }
}

async function deleteAccount(req, res, next) {
  try {
    const { id } = req.params;
    const data = await accountService.deleteAccount(id);
    return sendSuccess(res, 200, data, "Xóa tài khoản thành công.");
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
