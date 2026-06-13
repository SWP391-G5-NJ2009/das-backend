function validate(schema, payload) {
  const { error, value } = schema.validate(payload, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    error.statusCode = 400;
    error.code = "VALIDATION_ERROR";
    error.isOperational = true;
    throw error;
  }

  return value;
}

module.exports = { validate };
