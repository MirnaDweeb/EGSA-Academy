const mongoose = require('mongoose');

const AssessmentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      required: true,
      enum: [
        'Quiz',
        'Assignment',
        'Capstone',
        'Practical Assessment',
        'Technical Assessment',
        'Project Evaluation',
        'Final Assessment',
        'Assignment Evaluation',
        'Presentation Evaluation',
        'Participation Evaluation',
        'Other Instructor Evaluation',
      ],
      default: 'Technical Assessment',
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    cohort: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cohort',
      required: true,
    },
    session: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'TrainingSession',
    },
    instructor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    instructorName: {
      type: String,
      default: 'EGSA Faculty',
    },
    maxScore: {
      type: Number,
      required: true,
      default: 100,
      min: 1,
    },
    passingScore: {
      type: Number,
      default: 70,
      min: 0,
    },
    weight: {
      type: Number,
      default: 25, // percentage weight (e.g. 25%)
      min: 0,
    },
    status: {
      type: String,
      enum: ['Draft', 'Scheduled', 'In_Progress', 'Completed', 'Cancelled', 'Published'],
      default: 'Scheduled',
    },
    assessmentDate: {
      type: Date,
    },
    dueDate: {
      type: Date,
    },
    deadline: {
      type: Date,
    },
    lateGraceMinutes: {
      type: Number,
      default: 15,
    },
    latePenaltyPercent: {
      type: Number,
      default: 10,
    },
    questions: [
      {
        questionText: { type: String, required: true },
        options: [{ type: String, required: true }],
        correctOptionIndex: { type: Number, required: true },
        points: { type: Number, default: 25 },
        explanation: { type: String, default: '' },
      },
    ],
    rubric: {
      type: String,
    },
    instructions: {
      type: String,
      trim: true,
      default: '',
    },
    attachments: [
      {
        fileName: { type: String, required: true },
        originalName: { type: String, required: true },
        fileUrl: { type: String, required: true },
        mimeType: { type: String },
        sizeBytes: { type: Number },
        uploadedAt: { type: Date, default: Date.now },
      },
    ],
    submissionType: {
      type: String,
      enum: ['file', 'text', 'both', 'url'],
      default: 'file',
    },
    allowLateSubmission: {
      type: Boolean,
      default: true,
    },
    allowResubmission: {
      type: Boolean,
      default: false,
    },
    availableDate: {
      type: Date,
    },
    isMandatory: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

AssessmentSchema.pre('save', function (next) {
  if (this.deadline && !this.dueDate) {
    this.dueDate = this.deadline;
  } else if (this.dueDate && !this.deadline) {
    this.deadline = this.dueDate;
  }
  next();
});

AssessmentSchema.index({ cohort: 1, status: 1 });
AssessmentSchema.index({ course: 1 });
AssessmentSchema.index({ session: 1 });
AssessmentSchema.index({ instructor: 1 });

module.exports = mongoose.model('Assessment', AssessmentSchema);
