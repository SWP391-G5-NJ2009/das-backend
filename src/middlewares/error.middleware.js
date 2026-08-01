const { sendError } = require("../utils/response");

function notFoundMiddleware(req, res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.statusCode = 404;
  error.code = "NOT_FOUND";
  next(error);
}

function errorMiddleware(err, req, res, next) {
  const statusCode = err.statusCode || 500;
  const message = err.isOperational ? err.message : "Internal error";
  const code = err.code || null;
  const details = err.details || null;

  return sendError(res, statusCode, message, code, details);
}

module.exports = {
  notFoundMiddleware,
  errorMiddleware,
};
