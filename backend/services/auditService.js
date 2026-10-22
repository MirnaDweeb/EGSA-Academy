const AuditLog = require('../models/AuditLog');

// Single write path for audit records. Controllers call this instead of
// writing to AuditLog directly, so future phases (e.g. streaming audit
// events to an external log) only need to change this one function.
async function recordAudit({
  user,
  actor,
  action,
  resource,
  entity,
  resourceId = null,
  entityId = null,
  division = null,
  before = null,
  after = null,
  details = null,
  reason = '',
}) {
  try {
    const actorId = actor ? (actor._id || actor) : (user ? (user._id || user) : null);
    const targetEntity = entity || resource || 'Application';
    const targetId = entityId || resourceId;

    return await AuditLog.create({
      user: actorId,
      actor: actorId,
      action,
      resource: targetEntity,
      entity: targetEntity,
      resourceId: targetId,
      entityId: targetId,
      division,
      before,
      after,
      details: details || {
        previousStatus: before?.status,
        newStatus: after?.status,
        reason,
      },
      reason,
      timestamp: new Date(),
    });
  } catch (err) {
    // Auditing must never break the primary request flow.
    console.error('[audit] failed to record audit log:', err.message);
  }
}

module.exports = { recordAudit };
