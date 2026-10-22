const { body } = require('express-validator');

const updateProfileValidator = [
  body('division').optional().isIn(['PRE_UNIVERSITY', 'UNIVERSITY']).withMessage('Division must be PRE_UNIVERSITY or UNIVERSITY.'),
  body('status').optional().isIn(['student', 'graduate']).withMessage('Status must be student or graduate.'),
  body('phone').optional().trim(),
  body('nationalId').optional().trim(),
  body('personalInfo').optional().isObject().withMessage('personalInfo must be an object.'),
  body('academicInfo').optional().isObject().withMessage('academicInfo must be an object.'),
  body('spaceExperience').optional().isObject().withMessage('spaceExperience must be an object.'),
  body('university').optional().trim(),
  body('faculty').optional().trim(),
  body('department').optional().trim(),
  body('academicYear').optional().trim(),
  body('graduationYear').optional(),
  body('skills').optional().isArray().withMessage('Skills must be a list.'),
  body('experience').optional().isArray().withMessage('Experience must be a list.'),
  body('previousTraining').optional().isArray().withMessage('Previous training must be a list.'),
];

const setGoalValidator = [
  body('goalId').isMongoId().withMessage('A valid goalId is required.'),
];

module.exports = { updateProfileValidator, setGoalValidator };
