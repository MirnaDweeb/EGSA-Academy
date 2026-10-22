const mongoose = require('mongoose');

const NotificationSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    message: { type: String, required: true },
    type: {
      type: String,
      default: 'info',
    },
    recipient: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    relatedCourse: { type: mongoose.Schema.Types.ObjectId, ref: 'Course' },
    relatedApplication: { type: mongoose.Schema.Types.ObjectId, ref: 'Application' },
    link: { type: String },
    dedupeKey: { type: String, sparse: true },
    read: { type: Boolean, default: false },
    isRead: { type: Boolean, default: false },
    readAt: { type: Date },
  },
  { timestamps: true }
);

NotificationSchema.pre('validate', function (next) {
  if (!this.recipient && this.user) {
    this.recipient = this.user;
  }
  if (!this.user && this.recipient) {
    this.user = this.recipient;
  }
  if (this.read !== undefined && this.isRead === undefined) {
    this.isRead = this.read;
  }
  if (this.isRead !== undefined && this.read === undefined) {
    this.read = this.isRead;
  }
  next();
});

module.exports = mongoose.model('Notification', NotificationSchema);

