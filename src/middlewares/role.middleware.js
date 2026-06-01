const AppError = require("../utils/AppError");

const normalizeRole = (role) => String(role || "").toLowerCase();

function requireRole(...roles) {
  const allowedRoles = roles.map(normalizeRole);

  return (req, res, next) => {
    if (!allowedRoles.includes(normalizeRole(req.user?.role))) {
      return next(new AppError("Access denied.", 403, "FORBIDDEN"));
    }

    return next();
  };
}

module.exports = requireRole;
