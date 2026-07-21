function validateDetails(schema, payload) {
  const { error, value } = schema.validate(payload, {
    abortEarly: false,
    stripUnknown: true,
  });

  if (error) {
    const fieldErrors = {};
    error.details.forEach((detail) => {
      const field = detail.path.join(".");
      if (!fieldErrors[field]) fieldErrors[field] = [];
      fieldErrors[field].push(detail.message);
    })

    const err = new Error("Validation failed");
    err.statusCode = 400;
    err.code = "VALIDATION_ERROR";
    err.isOperational = true;
    err.details = fieldErrors;
    throw err;
  }

  return value;
}

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

module.exports = {
  validate,
  validateDetails
};
