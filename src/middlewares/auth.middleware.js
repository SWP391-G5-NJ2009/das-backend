const AppError = require("../utils/AppError");
const { verifyJWT } = require("../utils/jwt");

function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return next(new AppError("Vui lòng đăng nhập để tiếp tục.", 401, "UNAUTHORIZED"));
  }

  try {
    const token = authHeader.split(" ")[1];
    req.user = verifyJWT(token);
    return next();
  } catch {
    return next(
      new AppError("Token không hợp lệ hoặc đã hết hạn.", 401, "TThành côngEN_INVALID"),
    );
  }
}

module.exports = authMiddleware;
