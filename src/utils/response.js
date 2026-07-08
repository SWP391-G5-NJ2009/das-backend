const sendSuccess = (res, statusCode = 200, data = null, message = "OK") =>
  res.status(statusCode).json({ success: true, data, message });

const sendError = (
  res,
  statusCode = 500,
  message = "Internal error",
  code = null,
  details = null,
) =>
  res
    .status(statusCode)
    .json({ success: false, data: null, message, code, details });

module.exports = {
  sendSuccess,
  sendError,
};
