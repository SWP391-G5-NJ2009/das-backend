const AppError = require("../utils/AppError");
const normalizeRole = require("../utils/normalizeRole");

function requireRole(...roles) {
  const allowedRoles = roles.map(normalizeRole);

  return (req, res, next) => {
    if (!allowedRoles.includes(normalizeRole(req.user?.role))) {
      return next(new AppError("Bạn không có quyền truy cập.", 403, "FORBIDDEN"));
    }

    return next();
  };
}

module.exports = requireRole;
