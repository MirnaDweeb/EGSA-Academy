const mongoose = require('mongoose');

// Append-only. No update/delete routes are ever exposed for this model —
// see services/auditService.js, which is the only writer.
const auditLogSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    action: { type: String, required: true }, // e.g. "PROGRAM_CREATE", "ADMIN_OVERRIDE"
    resource: { type: String }, // e.g. "Course", "Application"
    resourceId: { type: mongoose.Schema.Types.ObjectId },
    entity: { type: String, default: 'Application' },
    entityId: { type: mongoose.Schema.Types.ObjectId },
    division: { type: String, default: null },
    before: { type: mongoose.Schema.Types.Mixed, default: null },
    after: { type: mongoose.Schema.Types.Mixed, default: null },
    details: { type: mongoose.Schema.Types.Mixed, default: null },
    reason: { type: String, default: '' },
    timestamp: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

auditLogSchema.pre('save', function (next) {
  if (!this.user && this.actor) this.user = this.actor;
  if (!this.actor && this.user) this.actor = this.user;
  if (!this.resource && this.entity) this.resource = this.entity;
  if (!this.entity && this.resource) this.entity = this.resource;
  if (!this.resourceId && this.entityId) this.resourceId = this.entityId;
  if (!this.entityId && this.resourceId) this.entityId = this.resourceId;
  if (!this.details && (this.before || this.after || this.reason)) {
    this.details = {
      previousStatus: this.before?.status,
      newStatus: this.after?.status,
      reason: this.reason,
    };
  }
  next();
});

auditLogSchema.index({ resource: 1, resourceId: 1 });
auditLogSchema.index({ entity: 1, entityId: 1 });
auditLogSchema.index({ user: 1, timestamp: -1 });
auditLogSchema.index({ actor: 1, timestamp: -1 });
auditLogSchema.index({ division: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ timestamp: -1 });
auditLogSchema.index({ resource: 1, timestamp: -1 });

module.exports = mongoose.model('AuditLog', auditLogSchema);

