const ApiError = require('../utils/ApiError');
const { ALL_DIVISIONS } = require('../constants/divisions');
const { PROGRAM_STATUS } = require('../constants/statuses');

function validateProgramInput(body = {}, { partial = false } = {}) {
  if (!partial) {
    if (!body.title || !body.title.trim()) {
      throw ApiError.badRequest('Program title is required');
    }
    if (!body.division || (ALL_DIVISIONS && !ALL_DIVISIONS.includes(body.division))) {
      throw ApiError.badRequest('Valid program division is required');
    }
  }

  if (body.price !== undefined && (isNaN(body.price) || Number(body.price) < 0)) {
    throw ApiError.badRequest('Price must be a non-negative number');
  }

  if (body.capacity !== undefined && (isNaN(body.capacity) || Number(body.capacity) <= 0)) {
    throw ApiError.badRequest('Capacity must be a positive number');
  }
}

function validateProgramStatusTransition(currentStatus, newStatus) {
  const allowed = Object.values(PROGRAM_STATUS || {
    DRAFT: 'Draft',
    OPEN: 'Open',
    CLOSED: 'Closed',
    ARCHIVED: 'Archived',
  });

  if (!allowed.includes(newStatus)) {
    throw ApiError.badRequest(`Invalid program status "${newStatus}". Must be one of: ${allowed.join(', ')}`);
  }
}

module.exports = {
  validateProgramInput,
  validateProgramStatusTransition,
};
