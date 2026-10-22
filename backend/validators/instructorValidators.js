const ApiError = require('../utils/ApiError');
const { ALL_DIVISIONS } = require('../constants/divisions');

function validateCreateInstructorInput(body = {}) {
  const { email, password, division, fullName, name } = body;
  const nameVal = (fullName || name || '').trim();

  if (!nameVal) {
    throw ApiError.badRequest('Instructor full name is required');
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw ApiError.badRequest('A valid email address is required');
  }
  if (!password || password.length < 8) {
    throw ApiError.badRequest('Password must be at least 8 characters long');
  }
  if (!division || (ALL_DIVISIONS && !ALL_DIVISIONS.includes(division))) {
    throw ApiError.badRequest('A valid institutional division is required');
  }
}

function validateUpdateInstructorStatusInput(body = {}) {
  if (typeof body.isActive !== 'boolean') {
    throw ApiError.badRequest('isActive must be a boolean');
  }
}

module.exports = {
  validateCreateInstructorInput,
  validateUpdateInstructorStatusInput,
};
