const instructorValidators = require('./instructor');
const authValidators = require('./authValidators');
const cycleValidators = require('./cycleValidators');
const studentValidators = require('./studentValidators');

module.exports = {
  ...instructorValidators,
  authValidators,
  cycleValidators,
  studentValidators,
  instructor: instructorValidators,
};
