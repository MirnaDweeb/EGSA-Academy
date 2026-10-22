const mongoose = require('mongoose');

const TrainingSessionSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    cohort: { type: mongoose.Schema.Types.ObjectId, ref: 'Cohort', required: true },
    sessionNumber: { type: Number, required: true },
    title: { type: String, required: true },
    focus: { type: String },
    activities: [{ type: String }],
    date: { type: Date, required: true },
    startTime: { type: String, default: '10:00 AM' },
    endTime: { type: String, default: '03:00 PM' },
    actualStartTime: { type: Date },
    actualEndTime: { type: Date },
    instructor: { type: String, default: 'EGSA Faculty' },
    location: { type: String, default: 'Egyptian Space Academy, Cairo' },
    deliveryMode: { type: String, enum: ['Onsite', 'Online', 'Hybrid'], default: 'Onsite' },
    status: {
      type: String,
      enum: ['Scheduled', 'Active', 'In_Progress', 'In Progress', 'in_progress', 'Completed', 'Cancelled'],
      default: 'Scheduled',
    },
    topic: { type: String, trim: true },
    materials: [
      {
        title: { type: String, required: true },
        fileUrl: { type: String, required: true },
        type: { type: String, default: 'PDF' },
        size: { type: String, default: '2.4 MB' },
      },
    ],
    meetingUrl: { type: String, trim: true },
    classroom: { type: String, default: 'EGSA Main Ground Station & Tracking Facility' },
    attendanceWindow: {
      opensAt: { type: Date },
      closesAt: { type: Date },
    },
    qrCode: {
      token: { type: String, index: true },
      code: { type: String },
      dataUrl: { type: String },
      expiresAt: { type: Date },
      generatedAt: { type: Date },
      isActive: { type: Boolean, default: true },
    },
  },
  { timestamps: true }
);

TrainingSessionSchema.index({ cohort: 1, sessionNumber: 1 }, { unique: true });

module.exports = mongoose.model('TrainingSession', TrainingSessionSchema);
