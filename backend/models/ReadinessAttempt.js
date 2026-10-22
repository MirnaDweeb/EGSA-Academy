const mongoose = require('mongoose');

const READINESS_OUTCOMES = [
  'Ready',
  'Conditionally Ready',
  'Foundation Required',
  'Manual Review',
  // Backward compatibility uppercase variants
  'READY',
  'ELIGIBLE',
  'CONDITIONALLY_READY',
  'FOUNDATION_REQUIRED',
  'FOUNDATION_RECOMMENDED',
  'MANUAL_REVIEW',
];

const ReadinessAttemptSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', default: null },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    questions: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ReadinessQuestion' }],
    answers: [
      {
        question: { type: mongoose.Schema.Types.ObjectId, ref: 'ReadinessQuestion' },
        selectedIndex: { type: Number },
        isCorrect: { type: Boolean },
      },
    ],
    status: { type: String, enum: ['InProgress', 'Submitted'], default: 'InProgress' },
    score: { type: Number },
    scorePercentage: { type: Number },
    topicBreakdown: [
      {
        topic: { type: String, required: true },
        totalQuestions: { type: Number, default: 0 },
        correctQuestions: { type: Number, default: 0 },
        score: { type: Number, default: 0 },
        passed: { type: Boolean, default: false },
      },
    ],
    outcome: {
      type: String,
      enum: READINESS_OUTCOMES,
    },
    knowledgeGaps: [{ type: String }],
    recommendedCourse: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    recommendedCourses: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Course' }],
    rationale: { type: String, default: null },
    adminOverride: {
      applied: { type: Boolean, default: false },
      reason: { type: String, default: null },
      adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      overriddenAt: { type: Date, default: null },
    },
    submittedAt: { type: Date },
  },
  { timestamps: true }
);

ReadinessAttemptSchema.pre('validate', function (next) {
  if (this.scorePercentage !== undefined && this.score === undefined) {
    this.score = this.scorePercentage;
  }
  if (this.score !== undefined && this.scorePercentage === undefined) {
    this.scorePercentage = this.score;
  }
  if (this.recommendedCourse && (!this.recommendedCourses || this.recommendedCourses.length === 0)) {
    this.recommendedCourses = [this.recommendedCourse];
  }
  if (this.recommendedCourses && this.recommendedCourses.length > 0 && !this.recommendedCourse) {
    this.recommendedCourse = this.recommendedCourses[0];
  }
  next();
});

ReadinessAttemptSchema.statics.OUTCOMES = READINESS_OUTCOMES;

module.exports = mongoose.model('ReadinessAttempt', ReadinessAttemptSchema);

