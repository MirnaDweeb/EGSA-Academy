const mongoose = require('mongoose');

const APPLICATION_STATUSES = [
  'Draft',
  'Submitted',
  'Eligible',
  'Conditionally Eligible',
  'Foundation Required',
  'Manual Review',
  'Rejected',
  'Under Review',
  'Needs Information',
  'Readiness Required',
  'Foundation Recommended',
  'Accepted',
  'Eligible - Payment Pending',
  'Waitlisted',
  'Provisional_Seat_Hold',
  'Confirmed',
  'In Progress',
  'Completed',
  'Incomplete',
  'Cancelled',
  'Expired',
  'No Show',
];

const ELIGIBILITY_STATUSES = [
  'Draft',
  'Submitted',
  'Eligible',
  'Conditionally Eligible',
  'Foundation Required',
  'Manual Review',
  'Rejected',
  'Not Started',
  'In Progress',
  'Not Eligible',
];

const ApplicationSchema = new mongoose.Schema(
  {
    referenceNumber: { type: String, unique: true, sparse: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    cohort: { type: mongoose.Schema.Types.ObjectId, ref: 'Cohort' },
    readinessAttempt: { type: mongoose.Schema.Types.ObjectId, ref: 'ReadinessAttempt' },
    status: { type: String, enum: APPLICATION_STATUSES, default: 'Draft' },
    eligibilityStatus: {
      type: String,
      enum: ELIGIBILITY_STATUSES,
      default: 'Draft',
    },
    missingRequirements: [{ type: String }],
    adminOverride: {
      applied: { type: Boolean, default: false },
      reason: { type: String, default: null },
      adminId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
      overriddenAt: { type: Date, default: null },
    },
    enrollment: { type: mongoose.Schema.Types.ObjectId, ref: 'Enrollment' },
    selectedPackage: {
      type: String,
      enum: ['WITHOUT_TRANSPORTATION', 'WITH_TRANSPORTATION'],
      default: 'WITHOUT_TRANSPORTATION',
    },
    rejectionReason: { type: String },
    statusHistory: [
      {
        status: { type: String, enum: APPLICATION_STATUSES },
        changedAt: { type: Date, default: Date.now },
        note: String,
      },
    ],
    fitResultSnapshot: { type: mongoose.Schema.Types.Mixed },
    submittedAt: { type: Date },
    waitlistPosition: { type: Number },
  },
  { timestamps: true }
);

ApplicationSchema.index({ student: 1, cohort: 1 });
ApplicationSchema.index({ cohort: 1, status: 1 });
ApplicationSchema.index({ cohort: 1, waitlistPosition: 1 });

ApplicationSchema.pre('save', function generateReference(next) {
  if (!this.referenceNumber) {
    const randomDigits = Math.floor(100000 + Math.random() * 900000);
    this.referenceNumber = `EGSA-APP-${randomDigits}`;
  }
  next();
});

ApplicationSchema.statics.STATUSES = APPLICATION_STATUSES;
ApplicationSchema.statics.ELIGIBILITY_STATUSES = ELIGIBILITY_STATUSES;

module.exports = mongoose.model('Application', ApplicationSchema);
