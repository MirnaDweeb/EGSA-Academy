class ApiResponse {
  constructor(statusCode, data, message = 'Success') {
    this.statusCode = statusCode;
    this.data = data;
    this.message = message;
    this.success = statusCode < 400;
  }
}

const sendSuccess = (res, arg2, arg3, arg4, arg5) => {
  let message = 'Success';
  let data = undefined;
  let statusCode = 200;
  let meta = undefined;

  if (typeof arg2 === 'number') {
    // Pattern: sendSuccess(res, statusCode, data, meta)
    statusCode = arg2;
    data = arg3;
    meta = arg4;
  } else if (typeof arg2 === 'string') {
    // Pattern: sendSuccess(res, message, data, statusCode, meta)
    message = arg2;
    data = arg3;
    if (typeof arg4 === 'number') {
      statusCode = arg4;
      meta = arg5;
    } else if (arg4 && typeof arg4 === 'object') {
      meta = arg4;
    }
  } else if (arg2 && typeof arg2 === 'object') {
    // Pattern: sendSuccess(res, data, statusCode, meta)
    data = arg2;
    if (typeof arg3 === 'number') {
      statusCode = arg3;
      meta = arg4;
    } else if (arg3 && typeof arg3 === 'object') {
      meta = arg3;
    }
  }

  if (typeof statusCode !== 'number' || isNaN(statusCode)) {
    statusCode = 200;
  }

  const payload = {
    success: true,
    message,
  };
  if (data !== undefined) {
    payload.data = data;
  }
  if (meta !== undefined) {
    payload.meta = meta;
  }
  return res.status(statusCode).json(payload);
};

const sendError = (res, message = 'An error occurred', statusCode = 400, errors = []) => {
  return res.status(statusCode).json({
    success: false,
    message,
    errors,
  });
};

module.exports = {
  ApiResponse,
  sendSuccess,
  sendError,
};
