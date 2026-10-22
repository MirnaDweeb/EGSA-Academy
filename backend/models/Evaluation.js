const mongoose = require('mongoose');

const EvaluationSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    course: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Course',
      required: true,
    },
    cohort: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Cohort',
    },
    enrollment: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Enrollment',
    },
    instructor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    ratings: {
      content: {
        type: Number,
        min: 1,
        max: 5,
      },
      instructor: {
        type: Number,
        min: 1,
        max: 5,
      },
      facilities: {
        type: Number,
        min: 1,
        max: 5,
      },
      labs: {
        type: Number,
        min: 1,
        max: 5,
      },
      organization: {
        type: Number,
        min: 1,
        max: 5,
      },
    },
    overallRating: {
      type: Number,
      min: 1,
      max: 5,
    },
    comments: {
      type: mongoose.Schema.Types.Mixed,
      default: '',
    },
    isAnonymous: {
      type: Boolean,
      default: true,
    },
    courseFeedbackCompleted: {
      type: Boolean,
      default: false,
    },
    courseFeedbackSubmittedAt: {
      type: Date,
    },
    // Egyptian Space Agency / Agency Feedback
    agencyFeedback: {
      trainingEnvironment: { type: Number, min: 1, max: 5 },
      facilitiesAndLabs: { type: Number, min: 1, max: 5 },
      organizationAndStaff: { type: Number, min: 1, max: 5 },
      platformExperience: { type: Number, min: 1, max: 5 },
      overallSatisfaction: { type: Number, min: 1, max: 5 },
      recommendAgency: { type: Boolean, default: true },
      comments: { type: String, trim: true, default: '' },
      submittedAt: { type: Date },
    },
    agencyFeedbackCompleted: {
      type: Boolean,
      default: false,
    },
    submittedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Pre-save synchronization for facilities <-> labs and overallRating
EvaluationSchema.pre('save', function (next) {
  if (this.ratings) {
    if (this.ratings.facilities != null && this.ratings.labs == null) {
      this.ratings.labs = this.ratings.facilities;
    } else if (this.ratings.labs != null && this.ratings.facilities == null) {
      this.ratings.facilities = this.ratings.labs;
    }

    if (!this.overallRating && this.ratings.content && this.ratings.instructor) {
      const fac = this.ratings.facilities || this.ratings.labs || 0;
      const org = this.ratings.organization || 0;
      const sum = this.ratings.content + this.ratings.instructor + fac + org;
      this.overallRating = Number((sum / 4).toFixed(2));
    }
  }
  next();
});

EvaluationSchema.index({ student: 1, course: 1 }, { unique: true });
EvaluationSchema.index({ course: 1 });
EvaluationSchema.index({ cohort: 1 });

module.exports = mongoose.model('Evaluation', EvaluationSchema);
