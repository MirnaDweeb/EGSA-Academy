const { validationResult } = require('express-validator');

/**
 * Universal validation middleware.
 * Supports both:
 * 1. Factory mode: validate([chain1, chain2]) => (req, res, next)
 * 2. Direct middleware mode: router.post('/path', [chain1], validate, handler)
 */
function validate(arg1, arg2, arg3) {
  // Direct middleware usage: validate(req, res, next)
  if (arg1 && arg1.headers && typeof arg3 === 'function') {
    const req = arg1;
    const res = arg2;
    const next = arg3;
    const result = validationResult(req);
    if (result.isEmpty()) return next();

    return res.status(400).json({
      success: false,
      message: 'Validation failed.',
      errors: result.array().map((e) => ({ field: e.path || e.param, message: e.msg })),
    });
  }

  // Factory usage: validate(validations)
  const validations = Array.isArray(arg1) ? arg1 : (arg1 ? [arg1] : []);
  return async (req, res, next) => {
    await Promise.all(validations.map((v) => (typeof v?.run === 'function' ? v.run(req) : Promise.resolve())));

    const result = validationResult(req);
    if (result.isEmpty()) return next();

    return res.status(400).json({
      success: false,
      message: 'Validation failed.',
      errors: result.array().map((e) => ({ field: e.path || e.param, message: e.msg })),
    });
  };
}

validate.validate = validate;
module.exports = validate;
module.exports.validate = validate;
