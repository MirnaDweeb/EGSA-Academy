const { Schema, model } = require('mongoose');
const { SUBMISSION_STATUS } = require('../config/constants');
const s = new Schema({
  externalSubmissionId: { type: String, index: true },
  assessment: { type: Schema.Types.ObjectId, ref: 'Assessment', required: true, index: true },
  cohort: { type: Schema.Types.ObjectId, ref: 'Cohort', required: true, index: true },
  student: { type: Schema.Types.ObjectId, ref: 'StudentReference', required: true },
  content: { type: String, trim: true, maxlength: 20000 },
  submissionUrl: { type: String, trim: true },
  notes: { type: String, trim: true },
  attachments: [{ name: String, url: String }],
  answers: [{ questionIndex: Number, selectedOption: Number, isCorrect: Boolean, pointsAwarded: Number }],
  submittedAt: { type: Date, default: Date.now },
  isLate: { type: Boolean, default: false },
  minutesLate: { type: Number, default: 0 },
  score: { type: Number },
  feedback: { type: String, trim: true },
  gradedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  gradedAt: { type: Date },
  status: { type: String, default: 'Submitted', index: true },
}, { timestamps: true });
s.index({ assessment: 1, student: 1 }, { unique: true });
module.exports = model('AssessmentSubmission', s);
