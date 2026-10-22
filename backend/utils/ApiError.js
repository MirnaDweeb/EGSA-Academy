class ApiError extends Error {
  constructor(statusCode, message, errors = [], stack = '') {
    super(message);
    this.statusCode = statusCode;
    this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
    this.isOperational = true;
    this.errors = errors;
    if (stack) {
      this.stack = stack;
    } else {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  static badRequest(msg = 'Bad Request', errors = []) {
    return new ApiError(400, msg, errors);
  }

  static unauthorized(msg = 'Unauthorized', errors = []) {
    return new ApiError(401, msg, errors);
  }

  static forbidden(msg = 'Forbidden', errors = []) {
    return new ApiError(403, msg, errors);
  }

  static notFound(msg = 'Resource Not Found', errors = []) {
    return new ApiError(404, msg, errors);
  }

  static conflict(msg = 'Conflict', errors = []) {
    return new ApiError(409, msg, errors);
  }

  static internal(msg = 'Internal Server Error', errors = []) {
    return new ApiError(500, msg, errors);
  }
}

module.exports = ApiError;
