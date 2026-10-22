const mongoose = require('mongoose');
const crypto = require('crypto');

const CertificateSchema = new mongoose.Schema(
  {
    certificateId: { type: String, unique: true, sparse: true },
    certificateNumber: { type: String, unique: true, sparse: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    cohort: { type: mongoose.Schema.Types.ObjectId, ref: 'Cohort' },
    enrollment: { type: mongoose.Schema.Types.ObjectId, ref: 'Enrollment' },
    recipientName: { type: String, required: true, trim: true },
    certificateName: { type: String, trim: true },
    issueDate: { type: Date, default: Date.now },
    submittedAt: { type: Date, default: Date.now },
    status: {
      type: String,
      enum: [
        'NOT_ELIGIBLE',
        'ELIGIBLE',
        'NAME_SUBMITTED',
        'UNDER_PREPARATION',
        'ISSUED',
        'REVOKED',
        // Backward-compatibility aliases
        'Eligible',
        'Pending',
        'Issued',
        'Revoked',
        'Valid',
      ],
      default: 'ISSUED',
    },
    feedbackCompleted: { type: Boolean, default: false },
    courseFeedbackCompleted: { type: Boolean, default: false },
    agencyFeedbackCompleted: { type: Boolean, default: false },
    feedbackDeadline: { type: Date },
    adminCreated: { type: Boolean, default: false },
    createdByAdmin: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    adminCreatedAt: { type: Date },
    verificationToken: { type: String, unique: true, sparse: true },
    verificationHash: { type: String },
    cryptographicSignature: { type: String },
    verificationUrl: { type: String },
    qrCode: { type: String },
    qrCodeDataUrl: { type: String },
    issuingAuthority: { type: String, default: 'Egyptian Space Agency (EgSA)' },
    criteriaSummary: {
      attendanceRate: { type: Number },
      assessmentsPassed: { type: Boolean },
      paymentStatus: { type: String },
      evaluationCompleted: { type: Boolean },
    },
    nameConfirmedAt: { type: Date, default: Date.now },
    nameConfirmedBy: {
      type: String,
      enum: ['student', 'admin', 'system'],
      default: 'student',
    },
    type: {
      type: String,
      enum: ['certificate', 'clearance'],
      default: 'certificate',
    },
    purpose: { type: String, trim: true },
    officialStampNumber: { type: String, trim: true },
    // Admin Upload & Issuance Details
    fileUrl: { type: String, trim: true },
    fileName: { type: String, trim: true },
    fileMimeType: { type: String, trim: true },
    fileSizeBytes: { type: Number },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    uploadedAt: { type: Date },
    issuedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    adminNotes: { type: String, trim: true },
    correctionHistory: [
      {
        oldName: { type: String, required: true },
        newName: { type: String, required: true },
        correctedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        correctedByName: { type: String },
        correctedAt: { type: Date, default: Date.now },
        reason: { type: String, trim: true },
      },
    ],
  },
  { timestamps: true }
);

CertificateSchema.index({ student: 1, course: 1, type: 1 });

CertificateSchema.pre('validate', function (next) {
  if (this.certificateName && !this.recipientName) {
    this.recipientName = this.certificateName;
  } else if (this.recipientName && !this.certificateName) {
    this.certificateName = this.recipientName;
  }

  if (!this.certificateNumber && !this.certificateId) {
    const hex = crypto.randomBytes(4).toString('hex').toUpperCase();
    const serial = `EGSA-CERT-2026-${hex}`;
    this.certificateNumber = serial;
    this.certificateId = serial;
  } else if (this.certificateNumber && !this.certificateId) {
    this.certificateId = this.certificateNumber;
  } else if (this.certificateId && !this.certificateNumber) {
    this.certificateNumber = this.certificateId;
  }

  if (!this.verificationToken) {
    this.verificationToken = crypto.randomBytes(16).toString('hex');
  }

  if (!this.verificationHash && this.certificateNumber) {
    this.verificationHash = crypto
      .createHash('sha256')
      .update(`${this.certificateNumber}:${this.student}:${this.course}:${this.issueDate || Date.now()}:EGSA_ACADEMY_KEY`)
      .digest('hex');
  }

  if (!this.cryptographicSignature) {
    this.cryptographicSignature = this.verificationHash;
  }

  next();
});

CertificateSchema.statics.generateVerificationToken = function () {
  return crypto.randomBytes(16).toString('hex');
};

CertificateSchema.statics.generateCertificateId = function () {
  const hex = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `EGSA-CERT-2026-${hex}`;
};

CertificateSchema.statics.generateCertificateSerial = function () {
  const hex = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `EGSA-CERT-2026-${hex}`;
};

module.exports = mongoose.model('Certificate', CertificateSchema);
