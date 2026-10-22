const mongoose = require('mongoose');

const SystemConfigSchema = new mongoose.Schema(
  {
    seatReservationHours: {
      type: Number,
      default: 72,
      min: 1,
      max: 720,
    },
    minimumAttendanceGate: {
      type: Number,
      default: 85,
      min: 1,
      max: 100,
    },
    passingAssessmentThreshold: {
      type: Number,
      default: 70,
      min: 1,
      max: 100,
    },
    academicYear: {
      type: String,
      default: '2026/2027',
      trim: true,
    },
    institutionName: {
      type: String,
      default: 'Egyptian Space Agency (EgSA) Space Academy',
      trim: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

/**
 * Returns the institutional configuration singleton, creating default values if empty.
 */
SystemConfigSchema.statics.getEffectiveConfig = async function () {
  let config = await this.findOne();
  if (!config) {
    config = await this.create({
      seatReservationHours: 72,
      minimumAttendanceGate: 85,
      passingAssessmentThreshold: 70,
    });
  }
  return config;
};

module.exports = mongoose.model('SystemConfig', SystemConfigSchema);
