const mongoose = require('mongoose');

const SubmissionVersionSchema = new mongoose.Schema(
  {
    version: { type: Number, required: true },
    textAnswer: { type: String, trim: true },
    file: {
      fileName: { type: String },
      originalName: { type: String },
      fileUrl: { type: String },
      mimeType: { type: String },
      sizeBytes: { type: Number },
      uploadedAt: { type: Date, default: Date.now },
    },
    submittedAt: { type: Date, default: Date.now },
    isLate: { type: Boolean, default: false },
  },
  { _id: false }
);

const StudentSubmissionSchema = new mongoose.Schema(
  {
    assessment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Assessment',
      required: true,
      index: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
      index: true,
    },
    cohort: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cohort',
      required: true,
      index: true,
    },
    enrollment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Enrollment',
      required: true,
    },
    submissionType: {
      type: String,
      enum: ['file', 'text', 'both', 'url'],
      required: true,
      default: 'file',
    },
    textAnswer: {
      type: String,
      trim: true,
      default: '',
    },
    submissionUrl: {
      type: String,
      trim: true,
      default: '',
    },
    notes: {
      type: String,
      trim: true,
      default: '',
    },
    file: {
      fileName: { type: String },
      originalName: { type: String },
      fileUrl: { type: String },
      mimeType: { type: String },
      sizeBytes: { type: Number },
      uploadedAt: { type: Date },
    },
    answers: [
      {
        questionIndex: { type: Number },
        selectedOption: { type: Number },
        isCorrect: { type: Boolean },
        pointsAwarded: { type: Number, default: 0 },
      },
    ],
    submittedAt: {
      type: Date,
      default: Date.now,
    },
    isLate: {
      type: Boolean,
      default: false,
    },
    minutesLate: {
      type: Number,
      default: 0,
    },
    score: {
      type: Number,
    },
    maxScore: {
      type: Number,
    },
    feedback: {
      type: String,
      trim: true,
      default: '',
    },
    gradedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    gradedAt: {
      type: Date,
    },
    version: {
      type: Number,
      default: 1,
      min: 1,
    },
    status: {
      type: String,
      enum: ['Submitted', 'Under_Review', 'Evaluated', 'Resubmitted', 'Graded', 'Pending_Review'],
      default: 'Submitted',
    },
    history: [SubmissionVersionSchema],
  },
  { timestamps: true }
);

// Exactly one active submission record per student per assessment
StudentSubmissionSchema.index({ assessment: 1, student: 1 }, { unique: true });
StudentSubmissionSchema.index({ cohort: 1, submittedAt: -1 });

module.exports = mongoose.model('StudentSubmission', StudentSubmissionSchema);
