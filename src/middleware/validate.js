const { BadRequestError } = require('../utils/errors');

/**
 * Express middleware factory that validates req.body against a Zod schema.
 * Attaches parsed/coerced values to req.validatedBody.
 */
function validate(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      const firstError = result.error.errors[0];
      return next(
        new BadRequestError(
          firstError.message,
          'VALIDATION_ERROR'
        )
      );
    }
    req.validatedBody = result.data;
    next();
  };
}

/**
 * Validate query parameters against a Zod schema.
 */
function validateQuery(schema) {
  return (req, _res, next) => {
    const result = schema.safeParse(req.query);
    if (!result.success) {
      const firstError = result.error.errors[0];
      return next(
        new BadRequestError(
          firstError.message,
          'VALIDATION_ERROR'
        )
      );
    }
    req.validatedQuery = result.data;
    next();
  };
}

module.exports = { validate, validateQuery };
