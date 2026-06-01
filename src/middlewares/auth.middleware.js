const AppError = require("../utils/AppError");
const { verifyJWT } = require("../utils/jwt");

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return next(new AppError("Authentication required.", 401, "UNAUTHORIZED"));
  }

  try {
    const token = authHeader.split(" ")[1];
    req.user = verifyJWT(token);
    return next();
  } catch {
    return next(new AppError("Invalid or expired token.", 401, "TOKEN_INVALID"));
  }
}

module.exports = authMiddleware;
