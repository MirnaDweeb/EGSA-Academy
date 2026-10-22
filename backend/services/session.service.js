const crypto = require('crypto');
const QRCode = require('qrcode');
const { Session, Cohort, Attendance } = require('../models');
const TrainingSession = require('../models/TrainingSession');
const AttendanceRecord = require('../models/AttendanceRecord');
const Enrollment = require('../models/Enrollment');
const EnrollmentReference = require('../models/EnrollmentReference');
const { SESSION_STATUS } = require('../config/constants');
const ApiError = require('../utils/ApiError');
const { pick } = require('../utils/helpers');
const { ownedCohort, ownedCohortIds, ownedSession } = require('./ownership.service');
const activity = require('./activity.service');
const { recordAudit } = require('./auditService');

/**
 * Calculates live classroom metrics for a session:
 * { totalEnrolled, scannedPendingCount, verifiedPresentCount, absentCount }
 */
async function getRosterCounts(sessionId, cohortId) {
  let sessionIds = [sessionId];
  try {
    const s = (await Session.findById(sessionId)) || (await TrainingSession.findById(sessionId));
    if (s) {
      const isTraining = s instanceof TrainingSession;
      const otherModel = isTraining ? Session : TrainingSession;
      const counterpart = await otherModel.findOne({ cohort: s.cohort, title: s.title });
      if (counterpart && String(counterpart._id) !== String(sessionId)) {
        sessionIds.push(counterpart._id);
      }
    }
  } catch (e) {}

  const [enrCount, refCount, pendingRecords, verifiedRecords, presentAtt, pendingAtt] = await Promise.all([
    Enrollment.countDocuments({
      cohort: cohortId,
      status: { $in: ['Active', 'Confirmed', 'Completed', 'enrolled', 'active'] },
    }),
    EnrollmentReference.countDocuments({ cohort: cohortId }),
    AttendanceRecord.countDocuments({
      session: { $in: sessionIds },
      status: 'pending_instructor_verification',
    }),
    AttendanceRecord.countDocuments({
      session: { $in: sessionIds },
      $or: [{ status: { $in: ['verified', 'Present', 'present'] } }, { verified: true }],
    }),
    Attendance.countDocuments({ session: { $in: sessionIds }, status: 'present' }),
    Attendance.countDocuments({ session: { $in: sessionIds }, status: 'pending' }),
  ]);

  const totalEnrolled = Math.max(enrCount, refCount);
  const scannedPendingCount = Math.max(pendingRecords, pendingAtt);
  const verifiedPresentCount = Math.max(verifiedRecords, presentAtt);
  const absentCount = Math.max(0, totalEnrolled - verifiedPresentCount - scannedPendingCount);

  return {
    totalEnrolled,
    scannedPendingCount,
    verifiedPresentCount,
    absentCount,
  };
}

/**
 * Generates a dynamic time-bound QR token and 6-char fallback alphanumeric code
 */
async function generateQRToken(sessionId) {
  const token = `EGSA-QR-${sessionId}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
  const code = crypto.randomBytes(3).toString('hex').toUpperCase(); // 6-character fallback code
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 10 * 60000); // 10 minutes explicit window

  const dataUrl = await QRCode.toDataURL(token, {
    errorCorrectionLevel: 'M',
    width: 400,
    margin: 2,
    color: { dark: '#0F2B48', light: '#FFFFFF' },
  });

  return {
    token,
    code,
    dataUrl,
    qrCodeDataUrl: dataUrl,
    generatedAt: now,
    expiresAt,
    isActive: true,
  };
}

/**
 * Keeps Session and TrainingSession models synchronized
 */
async function syncSessionPair(sessionDoc, updates = {}) {
  const isTraining = sessionDoc instanceof TrainingSession;
  const targetModel = isTraining ? Session : TrainingSession;

  await targetModel.findOneAndUpdate(
    { cohort: sessionDoc.cohort, $or: [{ _id: sessionDoc._id }, { title: sessionDoc.title }] },
    { $set: updates }
  ).catch(() => null);
}

async function list(instructorId, { cohortId, status, upcoming, page = 1, limit = 50 }) {
  let ids = await ownedCohortIds(instructorId);
  if (cohortId) {
    await ownedCohort(instructorId, cohortId);
    ids = [cohortId];
  }

  const normalizedStatus = status === 'in_progress' || status === 'In_Progress' ? { $in: ['in_progress', 'In_Progress', 'Active'] } : status;
  const q = {
    cohort: { $in: ids },
    ...(status ? { status: normalizedStatus } : {}),
    ...(upcoming === 'true' ? { startsAt: { $gte: new Date() }, status: SESSION_STATUS.SCHEDULED } : {}),
  };

  const [sessionItems, trainingItems, total] = await Promise.all([
    Session.find(q)
      .populate('course', 'title name code')
      .populate('cohort', 'name')
      .sort({ startsAt: upcoming === 'true' ? 1 : -1, date: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .lean(),
    TrainingSession.find({ cohort: { $in: ids } })
      .populate('course', 'title name code')
      .populate('cohort', 'name')
      .sort({ date: -1 })
      .limit(limit)
      .lean(),
    Session.countDocuments(q),
  ]);

  // Merge so instructor sees all scheduled curriculum sessions
  const seenTitles = new Set();
  const merged = [];

  for (const s of sessionItems) {
    const key = `${s.cohort?._id || s.cohort}:${s.title}`;
    if (!seenTitles.has(key)) {
      seenTitles.add(key);
      merged.push(s);
    }
  }

  for (const t of trainingItems) {
    const key = `${t.cohort?._id || t.cohort}:${t.title}`;
    if (!seenTitles.has(key)) {
      seenTitles.add(key);
      merged.push({
        ...t,
        startTime: t.startTime || '10:00',
        endTime: t.endTime || '14:00',
      });
    }
  }

  return { items: merged, meta: { page, limit, total: Math.max(total, merged.length) } };
}

async function get(instructorId, id) {
  const s = await ownedSession(instructorId, id);
  await s.populate([
    { path: 'course', select: 'title name code level' },
    { path: 'cohort', select: 'name startDate endDate' },
  ]);

  const cohortId = s.cohort?._id || s.cohort;
  const counts = await getRosterCounts(s._id, cohortId);

  // Generate QR dataUrl if token exists but dataUrl not stored
  if (s.qrCode?.token && !s.qrCode.dataUrl) {
    try {
      s.qrCode.dataUrl = await QRCode.toDataURL(s.qrCode.token, {
        errorCorrectionLevel: 'M',
        width: 400,
        margin: 2,
        color: { dark: '#0F2B48', light: '#FFFFFF' },
      });
      s.qrCode.qrCodeDataUrl = s.qrCode.dataUrl;
    } catch (_) {}
  }

  const obj = s.toObject ? s.toObject() : s;
  return {
    ...obj,
    attendanceSummary: counts,
    counts,
    totalEnrolled: counts.totalEnrolled,
    scannedPendingCount: counts.scannedPendingCount,
    verifiedPresentCount: counts.verifiedPresentCount,
    absentCount: counts.absentCount,
  };
}

const FIELDS = ['title', 'description', 'date', 'startTime', 'endTime', 'location', 'onlineUrl'];

async function create(instructorId, body) {
  const cohort = await ownedCohort(instructorId, body.cohortId);
  const s = await Session.create({ ...pick(body, FIELDS), cohort: cohort._id, course: cohort.course });
  await activity.log(instructorId, 'session.created', 'Session', s._id, `Created session "${s.title}"`);
  return s;
}

async function update(instructorId, id, body) {
  const s = await ownedSession(instructorId, id);
  if (s.status === SESSION_STATUS.CANCELLED) throw ApiError.conflict('A cancelled session cannot be modified');
  Object.assign(s, pick(body, [...FIELDS, 'status']));
  await s.save();
  await activity.log(instructorId, 'session.updated', 'Session', s._id, `Updated session "${s.title}"${body.status ? ` (${body.status})` : ''}`);
  return s;
}

/**
 * Step 1.1: Launch Live Session
 * Transitions session status to 'In_Progress'
 * Records actualStartTime = new Date()
 * Generates secure, time-bound QR check-in token with explicit expiration window
 * Logs action in institutional audit logs
 */
async function start(instructorId, id) {
  const s = await ownedSession(instructorId, id);
  if (s.status === 'Completed' || s.status === 'completed') {
    throw ApiError.badRequest('Session has already been completed.');
  }

  const now = new Date();
  s.status = 'In_Progress';
  s.actualStartTime = s.actualStartTime || now;

  // Generate dynamic QR check-in token
  const qr = await generateQRToken(s._id);
  s.qrCode = qr;

  if (s.attendanceWindow) {
    s.attendanceWindow.opensAt = new Date(now.getTime() - 60000);
    s.attendanceWindow.closesAt = qr.expiresAt;
  }

  await s.save();

  // Sync pair model
  await syncSessionPair(s, {
    status: 'In_Progress',
    actualStartTime: s.actualStartTime,
    qrCode: qr,
    ...(s.attendanceWindow ? { attendanceWindow: s.attendanceWindow } : {}),
  });

  // Institutional Audit Log
  await recordAudit({
    user: instructorId,
    action: 'SESSION_STARTED',
    resource: 'Session',
    resourceId: s._id,
    after: {
      status: 'In_Progress',
      actualStartTime: s.actualStartTime,
      qrToken: qr.token,
      expiresAt: qr.expiresAt,
    },
    reason: `Instructor launched live classroom session "${s.title}" with dynamic QR check-in broadcast`,
  });

  await activity.log(instructorId, 'session.started', 'Session', s._id, `Launched live session "${s.title}"`);

  const cohortId = s.cohort?._id || s.cohort;
  const counts = await getRosterCounts(s._id, cohortId);
  const obj = s.toObject ? s.toObject() : s;

  return {
    ...obj,
    status: 'In_Progress',
    actualStartTime: s.actualStartTime,
    qrCode: qr,
    counts,
    totalEnrolled: counts.totalEnrolled,
    scannedPendingCount: counts.scannedPendingCount,
    verifiedPresentCount: counts.verifiedPresentCount,
  };
}

/**
 * Step 1.1: Conclude Session
 * Transitions session status to 'Completed'
 * Records actualEndTime = new Date()
 * Invalidates active QR token to prevent post-session check-ins
 * Logs action in institutional audit logs
 */
async function end(instructorId, id) {
  const s = await ownedSession(instructorId, id);
  const now = new Date();

  s.status = 'Completed';
  s.actualEndTime = now;

  if (s.qrCode) {
    s.qrCode.isActive = false;
    s.qrCode.expiresAt = now;
  }

  if (s.attendanceWindow) {
    s.attendanceWindow.closesAt = now;
  }

  await s.save();

  // Sync pair model
  await syncSessionPair(s, {
    status: 'Completed',
    actualEndTime: now,
    'qrCode.isActive': false,
    'qrCode.expiresAt': now,
    ...(s.attendanceWindow ? { 'attendanceWindow.closesAt': now } : {}),
  });

  // Institutional Audit Log
  await recordAudit({
    user: instructorId,
    action: 'SESSION_COMPLETED',
    resource: 'Session',
    resourceId: s._id,
    after: {
      status: 'Completed',
      actualEndTime: now,
      qrActive: false,
    },
    reason: `Instructor concluded classroom session "${s.title}" and invalidated QR check-in tokens`,
  });

  await activity.log(instructorId, 'session.ended', 'Session', s._id, `Concluded session "${s.title}"`);

  const cohortId = s.cohort?._id || s.cohort;
  const counts = await getRosterCounts(s._id, cohortId);
  const obj = s.toObject ? s.toObject() : s;

  return {
    ...obj,
    status: 'Completed',
    actualEndTime: now,
    qrCode: s.qrCode,
    counts,
    totalEnrolled: counts.totalEnrolled,
    scannedPendingCount: counts.scannedPendingCount,
    verifiedPresentCount: counts.verifiedPresentCount,
  };
}

/**
 * Step 1.1: Regenerate / Cycle QR Token
 * Generates fresh QR token for on-premise security cycling while session is active
 */
async function regenerateQR(instructorId, id) {
  const s = await ownedSession(instructorId, id);
  if (s.status === 'Completed' || s.status === 'completed') {
    throw ApiError.badRequest('Cannot regenerate QR token for a completed session.');
  }

  const qr = await generateQRToken(s._id);
  s.qrCode = qr;

  if (s.attendanceWindow) {
    s.attendanceWindow.closesAt = qr.expiresAt;
  }

  await s.save();

  // Sync pair model
  await syncSessionPair(s, {
    qrCode: qr,
    ...(s.attendanceWindow ? { 'attendanceWindow.closesAt': qr.expiresAt } : {}),
  });

  // Institutional Audit Log
  await recordAudit({
    user: instructorId,
    action: 'SESSION_QR_CYCLED',
    resource: 'Session',
    resourceId: s._id,
    after: {
      qrToken: qr.token,
      expiresAt: qr.expiresAt,
    },
    reason: `Instructor manually cycled QR broadcast token for session "${s.title}"`,
  });

  const cohortId = s.cohort?._id || s.cohort;
  const counts = await getRosterCounts(s._id, cohortId);
  const obj = s.toObject ? s.toObject() : s;

  return {
    ...obj,
    qrCode: qr,
    counts,
    totalEnrolled: counts.totalEnrolled,
    scannedPendingCount: counts.scannedPendingCount,
    verifiedPresentCount: counts.verifiedPresentCount,
  };
}

module.exports = {
  list,
  get,
  create,
  update,
  start,
  end,
  regenerateQR,
  getRosterCounts,
};
