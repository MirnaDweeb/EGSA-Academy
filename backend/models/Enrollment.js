const mongoose = require('mongoose');

const EnrollmentSchema = new mongoose.Schema(
  {
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    cohort: { type: mongoose.Schema.Types.ObjectId, ref: 'Cohort' },
    application: { type: mongoose.Schema.Types.ObjectId, ref: 'Application', required: true },
    enrollmentDate: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: [
        'Confirmed',
        'Active',
        'Completed',
        'Cancelled',
        'No Show',
        'Pending Payment',
        'PENDING_PAYMENT',
        'CONFIRMED',
        'Hold',
        'Waitlisted',
        'Released',
        'Withdrawn',
        'Provisional_Seat_Hold',
      ],
      default: 'Confirmed',
    },
    seatStatus: {
      type: String,
      enum: ['Hold', 'Confirmed', 'Waitlisted', 'Released', 'Withdrawn', 'Provisional_Seat_Hold'],
      default: 'Hold',
    },
    seatLocked: { type: Boolean, default: false },
    paymentStatus: {
      type: String,
      enum: ['Pending', 'Paid', 'Waived'],
      default: 'Pending',
    },
    packageType: {
      type: String,
      enum: ['WITHOUT_TRANSPORTATION', 'WITH_TRANSPORTATION'],
      default: 'WITHOUT_TRANSPORTATION',
    },
    transportationRequired: { type: Boolean, default: false },
    paidAmount: { type: Number },
    paymentReference: { type: mongoose.Schema.Types.ObjectId, ref: 'PaymentTransaction' },
    evaluationCompleted: { type: Boolean, default: false },
    evaluationSubmittedAt: { type: Date },
  },
  { timestamps: true }
);

EnrollmentSchema.index({ student: 1, cohort: 1 }, { unique: true, sparse: true });
EnrollmentSchema.index({ student: 1, course: 1 });
EnrollmentSchema.index({ cohort: 1, status: 1 });

module.exports = mongoose.model('Enrollment', EnrollmentSchema);
