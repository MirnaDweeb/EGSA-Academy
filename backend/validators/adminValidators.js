const ApiError = require('../utils/ApiError');
const { ROLES } = require('../constants/roles');
const { ALL_DIVISIONS } = require('../constants/divisions');

const ALLOWED_ADMIN_ROLES = [
  ROLES.PRE_UNIVERSITY_ADMIN || 'pre_university_admin',
  ROLES.UNIVERSITY_ADMIN || 'university_admin',
];

function validateCreateAdminInput(body = {}) {
  const { email, password, role, division, fullName, name } = body;
  const nameVal = (fullName || name || '').trim();

  if (!nameVal) {
    throw ApiError.badRequest('Full name is required');
  }
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw ApiError.badRequest('A valid email address is required');
  }
  if (!password || password.length < 8) {
    throw ApiError.badRequest('Password must be at least 8 characters');
  }
  if (!role || !ALLOWED_ADMIN_ROLES.includes(role)) {
    throw ApiError.badRequest(`Role must be one of: ${ALLOWED_ADMIN_ROLES.join(', ')}`);
  }
  if (!division || !ALL_DIVISIONS.includes(division)) {
    throw ApiError.badRequest(`Division must be one of: ${ALL_DIVISIONS.join(', ')}`);
  }
}

function validateUpdateAdminStatusInput(body = {}) {
  if (typeof body.isActive !== 'boolean') {
    throw ApiError.badRequest('isActive must be a boolean');
  }
}

module.exports = {
  ALLOWED_ADMIN_ROLES,
  validateCreateAdminInput,
  validateUpdateAdminStatusInput,
};
