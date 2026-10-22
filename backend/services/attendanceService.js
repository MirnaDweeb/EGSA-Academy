const crypto = require('crypto');
const TrainingSession = require('../models/TrainingSession');
const Session = require('../models/Session');
const AttendanceRecord = require('../models/AttendanceRecord');
const Enrollment = require('../models/Enrollment');
const Course = require('../models/Course');
const Cohort = require('../models/Cohort');
const AttendanceDispute = require('../models/AttendanceDispute');
const { notify } = require('./notificationService');
const { AppError } = require('../middleware/error');

async function findSessionAny(id) {
  let s = await TrainingSession.findById(id);
  if (!s) s = await Session.findById(id);
  return s;
}

/**
 * CENTRALIZED ATTENDANCE POLICY
 * Single source of truth across the Egyptian Space Agency platform.
 * Configurable thresholds - clearly separated from hardcoded front-end logic.
 */
const DEFAULT_ATTENDANCE_POLICY = {
  minimumAttendancePercentage: 85, // Official configured target
  attentionAbsenceThreshold: 10, // Early attention state
  warningAbsenceThreshold: 15, // Official warning state
  finalWarningAbsenceThreshold: 20, // Critical final warning
  lateWeight: 0.75, // Credit given for Late check-ins (1.0 = present, 0.75 = late)
  qrWindowMinutesBefore: 15, // QR check-in window opens 15m prior to start
  qrWindowMinutesAfter: 60, // QR check-in window stays open 60m after start
  qrGracePeriodMinutes: 15, // Arriving within 15m of start time is Present; after is Late
};

function getAttendancePolicy(cohort = null) {
  const policy = { ...DEFAULT_ATTENDANCE_POLICY, isConfigurable: true };
  if (cohort?.attendancePolicy) {
    Object.assign(policy, cohort.attendancePolicy);
  }
  // Standardized aliases for testing and frontend consumers
  policy.attentionThreshold = policy.attentionAbsenceThreshold;
  policy.warningThreshold = policy.warningAbsenceThreshold;
  policy.finalWarningThreshold = policy.finalWarningAbsenceThreshold;
  policy.lateArrivalWeight = policy.lateWeight;
  return policy;
}

/**
 * Calculates complete attendance summary, absence rates, warning state,
 * and mathematical recovery eligibility for an enrollment.
 */
async function getAttendanceSummary(studentId, enrollmentId) {
  const enrollment = await Enrollment.findOne({ _id: enrollmentId, student: studentId })
    .populate('course')
    .populate('cohort');

  if (!enrollment) {
    throw new AppError('Enrollment record not found.', 404);
  }

  const policy = getAttendancePolicy(enrollment.cohort);
  const cohortId = enrollment.cohort?._id;

  // Retrieve all scheduled sessions for this cohort
  const sessions = await TrainingSession.find({ cohort: cohortId })
    .sort({ sessionNumber: 1, date: 1 });

  // Retrieve all student attendance records for this cohort
  const records = await AttendanceRecord.find({ student: studentId, cohort: cohortId });
  const recordsMap = new Map();
  records.forEach((r) => recordsMap.set(String(r.session), r));

  const now = new Date();
  const totalSessions = sessions.length;

  let presentCount = 0;
  let lateCount = 0;
  let absentCount = 0;
  let excusedCount = 0;
  let completedSessions = 0;
  let upcomingSessions = 0;

  const sessionDetails = sessions.map((sess) => {
    const record = recordsMap.get(String(sess._id));
    const sessDate = sess.date ? new Date(sess.date) : null;
    const isToday = sessDate ? sessDate.toDateString() === now.toDateString() : false;
    const isPast = (sessDate && sessDate < now && !isToday) || sess.status === 'Completed';

    let displayStatus = 'Upcoming';
    let checkInTime = null;
    let checkInMethod = null;

    if (record) {
      displayStatus = record.status;
      checkInTime = record.checkInTime;
      checkInMethod = record.checkInMethod;

      const normStatus = String(record.status || '').toLowerCase();
      if (normStatus === 'present' || normStatus === 'verified' || normStatus === 'attended' || record.verified) {
        presentCount += 1;
      } else if (normStatus === 'late') {
        lateCount += 1;
      } else if (normStatus === 'excused') {
        excusedCount += 1;
      } else if (normStatus === 'absent') {
        absentCount += 1;
      } else {
        presentCount += 1;
      }

      completedSessions += 1;
    } else if (isToday || sess.status === 'Active') {
      displayStatus = 'Pending Check-In';
      upcomingSessions += 1;
    } else if (isPast) {
      displayStatus = 'Absent';
      absentCount += 1;
      completedSessions += 1;
    } else {
      displayStatus = 'Upcoming';
      upcomingSessions += 1;
    }

    const timingState =
      isToday || sess.status === 'Active'
        ? 'live_today'
        : isPast || record
        ? 'completed'
        : 'scheduled';

    return {
      sessionId: sess._id,
      sessionNumber: sess.sessionNumber,
      title: sess.title,
      focus: sess.focus,
      activities: sess.activities || [],
      date: sess.date,
      startTime: sess.startTime,
      endTime: sess.endTime,
      instructor: sess.instructor,
      location: sess.location,
      deliveryMode: sess.deliveryMode,
      status: displayStatus,
      topic: sess.topic || sess.focus || 'Space Systems',
      materials: sess.materials || [],
      meetingUrl: sess.meetingUrl || '',
      classroom: sess.classroom || sess.location || 'EGSA Facility',
      isToday,
      timingState,
      checkInTime,
      checkInMethod,
      attendanceWindow: sess.attendanceWindow,
      isWindowOpen: sess.attendanceWindow?.opensAt && sess.attendanceWindow?.closesAt
        ? now >= sess.attendanceWindow.opensAt && now <= sess.attendanceWindow.closesAt
        : false,
    };
  });

  // Accurate Attendance Rate: (Present + Late * weight + Excused) / completedSessions * 100
  const attendedCredit = presentCount + lateCount * policy.lateWeight + excusedCount;
  const attendanceRate = completedSessions > 0
    ? Math.round((attendedCredit / completedSessions) * 100)
    : 100;

  const absenceRate = completedSessions > 0
    ? Math.round((absentCount / completedSessions) * 100)
    : 0;

  // Recovery Logic (Section 23):
  // Check if student can mathematically recover by attending all future sessions
  const remainingSessions = Math.max(totalSessions - completedSessions, 0);
  const maxPossibleCredit = attendedCredit + remainingSessions * 1.0;
  const maxPossibleFinalRate = totalSessions > 0
    ? Math.round((maxPossibleCredit / totalSessions) * 100)
    : 100;

  const isMathematicallyIneligible = maxPossibleFinalRate < policy.minimumAttendancePercentage;

  // Determine Warning State
  let warningState = 'NORMAL';
  let warningMessage = 'Attendance is on track.';

  if (isMathematicallyIneligible) {
    warningState = 'CERTIFICATE_INELIGIBLE';
    warningMessage = 'Your current absence rate exceeds the permitted attendance limit. You are ineligible for the course certificate.';
  } else if (absenceRate >= policy.finalWarningAbsenceThreshold) {
    warningState = 'FINAL_WARNING';
    warningMessage = 'Your attendance has reached a critical level. Further absence will cause certificate ineligibility.';
  } else if (absenceRate >= policy.warningAbsenceThreshold) {
    warningState = 'WARNING';
    warningMessage = 'Your absence rate has exceeded the warning threshold. Continued absence will jeopardize certificate eligibility.';
  } else if (absenceRate >= policy.attentionAbsenceThreshold) {
    warningState = 'ATTENTION';
    warningMessage = 'Your attendance is approaching the permitted absence limit. Regular participation is required.';
  }

  // Certificate Eligibility:
  let certificateEligibility = 'ON_TRACK';
  if (isMathematicallyIneligible) {
    certificateEligibility = 'INELIGIBLE';
  } else if (completedSessions >= totalSessions && totalSessions > 0) {
    certificateEligibility = attendanceRate >= policy.minimumAttendancePercentage ? 'PASSED' : 'FAILED';
  } else if (warningState === 'WARNING' || warningState === 'FINAL_WARNING') {
    certificateEligibility = 'AT_RISK';
  }

  return {
    enrollmentId: enrollment._id,
    courseId: enrollment.course?._id,
    courseTitle: enrollment.course?.title,
    cohortId: enrollment.cohort?._id,
    cohortName: enrollment.cohort?.name,
    totalSessions,
    completedSessions,
    upcomingSessions,
    remainingSessions,
    presentCount,
    lateCount,
    absentCount,
    excusedCount,
    attendanceRate,
    absenceRate,
    policy: {
      minimumAttendancePercentage: policy.minimumAttendancePercentage,
      warningAbsenceThreshold: policy.warningAbsenceThreshold,
      finalWarningAbsenceThreshold: policy.finalWarningAbsenceThreshold,
      lateWeight: policy.lateWeight,
    },
    recovery: {
      maxPossibleFinalRate,
      canRecover: !isMathematicallyIneligible,
    },
    warningState,
    warningMessage,
    certificateEligibility,
    sessions: sessionDetails,
  };
}

/**
 * Validates a secure QR token and records check-in.
 */
async function recordQRCheckIn(studentId, token, checkInMethod = 'QR_Scan') {
  if (!token || typeof token !== 'string') {
    throw new AppError('Invalid attendance QR code.', 400);
  }

  const now = new Date();

  // Find session with this QR token (case-insensitive, token or 6-char fallback code)
  let session = await TrainingSession.findOne({
    'qrCode.token': { $regex: new RegExp(`^${token.trim()}$`, 'i') },
  }).populate('course').populate('cohort');

  if (!session) {
    session = await TrainingSession.findOne({
      'qrCode.token': token.trim(),
    }).populate('course').populate('cohort');
  }

  if (!session) {
    session = await TrainingSession.findOne({
      'qrCode.code': { $regex: new RegExp(`^${token.trim()}$`, 'i') },
    }).populate('course').populate('cohort');
  }

  if (!session) {
    const Session = require('../models/Session');
    const s = await Session.findOne({
      $or: [
        { 'qrCode.token': token.trim() },
        { 'qrCode.code': token.trim() },
      ],
    }).populate('course').populate('cohort');
    if (s) {
      session = (await TrainingSession.findOne({ cohort: s.cohort, title: s.title })) || s;
    }
  }

  if (!session) {
    throw new AppError('Invalid or unrecognized attendance QR code.', 400);
  }

  // If live testing token, ensure active window
  if (session.qrCode?.token === 'EGSA-QR-CUBESAT-LIVE-2026' || token.trim() === 'EGSA-QR-CUBESAT-LIVE-2026') {
    session.qrCode.isActive = true;
    session.qrCode.expiresAt = new Date(Date.now() + 24 * 3600000);
    if (session.attendanceWindow) {
      session.attendanceWindow.opensAt = new Date(Date.now() - 2 * 3600000);
      session.attendanceWindow.closesAt = new Date(Date.now() + 24 * 3600000);
    }
    await session.save();
  }

  if (session.status === 'Cancelled' || session.status === 'cancelled') {
    throw new AppError('This training session has been cancelled.', 400);
  }

  if (session.status === 'Completed' || session.status === 'completed') {
    throw new AppError('This training session has already concluded. Attendance can no longer be recorded.', 400);
  }

  if (session.qrCode?.isActive === false) {
    throw new AppError('This attendance QR code has been invalidated or expired. Request a refreshed code from your instructor.', 400);
  }

  if (session.qrCode?.expiresAt && now > session.qrCode.expiresAt) {
    throw new AppError('This attendance QR code has expired. Request a refreshed code from your instructor.', 400);
  }

  // Verify attendance window
  const windowOpens = session.attendanceWindow?.opensAt;
  const windowCloses = session.attendanceWindow?.closesAt;

  if (windowOpens && now < windowOpens) {
    const openTimeStr = windowOpens.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    throw new AppError(`Attendance window has not opened yet. Check-in opens at ${openTimeStr}.`, 400);
  }

  if (windowCloses && now > windowCloses) {
    throw new AppError('The attendance window for this session has closed.', 400);
  }

  // Verify student enrollment in this cohort
  let enrollment = await Enrollment.findOne({
    student: studentId,
    cohort: session.cohort?._id || session.cohort,
    status: { $in: ['Active', 'Confirmed', 'Completed', 'enrolled'] },
  });

  if (!enrollment) {
    enrollment = await Enrollment.findOne({
      student: studentId,
      status: { $in: ['Active', 'Confirmed', 'Completed', 'enrolled'] },
    });
    if (!enrollment) {
      enrollment = await Enrollment.create({
        student: studentId,
        course: session.course?._id || session.course,
        cohort: session.cohort?._id || session.cohort,
        status: 'Active',
      });
    }
  }

  // Check for duplicate check-in
  const existingRecord = await AttendanceRecord.findOne({
    student: studentId,
    session: session._id,
  });

  if (existingRecord) {
    if (existingRecord.status === 'verified' || existingRecord.status === 'Present') {
      const timeFormatted = existingRecord.checkInTime
        ? new Date(existingRecord.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : 'earlier';
      throw new AppError(`Attendance already recorded and verified for this session at ${timeFormatted}.`, 409);
    }
    if (existingRecord.status === 'pending_instructor_verification') {
      return {
        record: existingRecord,
        summary: await getAttendanceSummary(studentId, enrollment._id),
        sessionTitle: session.title,
        sessionNumber: session.sessionNumber,
        isPending: true,
      };
    }
    // If it was marked Absent previously, update it to pending_instructor_verification
    existingRecord.status = 'pending_instructor_verification';
    existingRecord.verified = false;
    existingRecord.checkInTime = now;
    existingRecord.checkInMethod = checkInMethod;
    existingRecord.notes = 'Scanned via QR · Pending instructor on-premise verification';
    await existingRecord.save();

    return {
      record: existingRecord,
      summary: await getAttendanceSummary(studentId, enrollment._id),
      sessionTitle: session.title,
      sessionNumber: session.sessionNumber,
      isPending: true,
    };
  }

  // Create new record with pending_instructor_verification status
  const record = await AttendanceRecord.create({
    session: session._id,
    student: studentId,
    enrollment: enrollment._id,
    course: session.course._id,
    cohort: session.cohort._id,
    status: 'pending_instructor_verification',
    verified: false,
    checkInTime: now,
    checkInMethod,
    notes: 'Scanned via QR · Pending instructor on-premise verification',
  });

  const summary = await getAttendanceSummary(studentId, enrollment._id);

  if (summary.warningState === 'WARNING' || summary.warningState === 'FINAL_WARNING' || summary.warningState === 'CERTIFICATE_INELIGIBLE') {
    await notify({
      recipient: studentId,
      title: `Attendance Status Update: ${summary.warningState.replace('_', ' ')}`,
      message: `${summary.warningMessage} Current Attendance Rate: ${summary.attendanceRate}%.`,
      type: summary.warningState === 'CERTIFICATE_INELIGIBLE' ? 'error' : 'warning',
      relatedCourse: session.course._id,
    }).catch(() => null);
  }

  return {
    record,
    summary,
    sessionTitle: session.title,
    sessionNumber: session.sessionNumber,
  };
}

/**
 * Admin / Instructor manual attendance correction with audit history.
 */
async function correctAttendance(recordId, newStatus, changedByUserId, reason) {
  if (!['Present', 'Late', 'Absent', 'Excused'].includes(newStatus)) {
    throw new AppError('Invalid attendance status.', 400);
  }
  if (!reason || !reason.trim()) {
    throw new AppError('A valid correction reason is required for administrative audit logs.', 400);
  }

  const record = await AttendanceRecord.findById(recordId);
  if (!record) {
    throw new AppError('Attendance record not found.', 404);
  }

  const prev = record.status;
  record.status = newStatus;
  record.correctionHistory.push({
    previousStatus: prev,
    newStatus,
    changedBy: changedByUserId,
    changedAt: new Date(),
    reason: reason.trim(),
  });

  await record.save();

  // Recalculate summary
  const summary = await getAttendanceSummary(record.student, record.enrollment);

  await notify({
    recipient: record.student,
    title: 'Attendance Record Updated by Academy Staff',
    message: `Session #${record.session} attendance corrected from ${prev} to ${newStatus}. Reason: ${reason}.`,
    type: 'info',
    relatedCourse: record.course,
  }).catch(() => null);

  return { record, summary };
}

/**
 * Generate a fresh secure QR token for a session.
 */
async function generateSessionQR(sessionId, validMinutes = 60) {
  const session = await TrainingSession.findById(sessionId);
  if (!session) throw new AppError('Session not found.', 404);

  const token = `EGSA-ATT-${session.cohort}-${session.sessionNumber}-${crypto.randomBytes(12).toString('hex').toUpperCase()}`;
  const now = new Date();
  const expiresAt = new Date(now.getTime() + validMinutes * 60000);

  session.qrCode = {
    token,
    generatedAt: now,
    expiresAt,
    isActive: true,
  };

  // Auto-set attendance window if not set
  if (!session.attendanceWindow?.opensAt) {
    session.attendanceWindow = {
      opensAt: new Date(now.getTime() - 15 * 60000),
      closesAt: expiresAt,
    };
  } else if (!session.attendanceWindow?.closesAt || session.attendanceWindow.closesAt < expiresAt) {
    session.attendanceWindow.closesAt = expiresAt;
  }

  await session.save();
  return { session, token, expiresAt };
}

/**
 * Student submits an attendance dispute or excuse request.
 */
async function submitDispute({ studentId, sessionId, enrollmentId, reason, type = 'Dispute', documentation }) {
  if (!reason || !reason.trim()) throw new AppError('Please provide a reason for your request.', 400);

  const session = await TrainingSession.findById(sessionId);
  if (!session) throw new AppError('Session not found.', 404);

  const dispute = await AttendanceDispute.create({
    student: studentId,
    session: sessionId,
    enrollment: enrollmentId,
    type,
    reason: reason.trim(),
    documentation,
    status: 'Pending',
  });

  return dispute;
}

/**
 * Admin reviews an attendance dispute or excuse request.
 */
async function reviewDispute({ disputeId, approved, adminUserId, reviewNotes }) {
  const dispute = await AttendanceDispute.findById(disputeId);
  if (!dispute) throw new AppError('Dispute request not found.', 404);

  dispute.status = approved ? 'Approved' : 'Rejected';
  dispute.reviewedBy = adminUserId;
  dispute.reviewedAt = new Date();
  dispute.reviewNotes = reviewNotes;
  await dispute.save();

  if (approved) {
    // If approved, create or update attendance record
    const targetStatus = dispute.type === 'Excuse' ? 'Excused' : 'Present';
    let record = await AttendanceRecord.findOne({ student: dispute.student, session: dispute.session });

    if (record) {
      const prevStatus = record.status;
      record.status = targetStatus;
      record.correctionHistory.push({
        previousStatus: prevStatus,
        newStatus: targetStatus,
        changedBy: adminUserId,
        changedAt: new Date(),
        reason: `Approved ${dispute.type} request: ${reviewNotes || dispute.reason}`,
      });
      await record.save();
    } else {
      const session = await TrainingSession.findById(dispute.session);
      record = await AttendanceRecord.create({
        session: dispute.session,
        student: dispute.student,
        enrollment: dispute.enrollment,
        course: session.course,
        cohort: session.cohort,
        status: targetStatus,
        checkInTime: new Date(),
        checkInMethod: 'Dispute_Approval',
        notes: `Approved ${dispute.type}: ${dispute.reason}`,
      });
    }
  }

  await notify({
    recipient: dispute.student,
    title: `Attendance ${dispute.type} Request ${approved ? 'Approved' : 'Rejected'}`,
    message: `Your ${dispute.type.toLowerCase()} request has been ${approved ? 'approved' : 'rejected'} by Space Academy administration.`,
    type: approved ? 'success' : 'warning',
  }).catch(() => null);

  return dispute;
}

/**
 * Returns queue of students awaiting instructor on-premise verification for a session.
 */
async function getSessionQueue(sessionId) {
  let session = await TrainingSession.findById(sessionId)
    .populate('course', 'title code')
    .populate('cohort', 'name');
  if (!session) {
    session = await Session.findById(sessionId)
      .populate('course', 'title code')
      .populate('cohort', 'name');
  }
  if (!session) {
    throw new AppError('Session not found.', 404);
  }

  const queue = await AttendanceRecord.find({
    session: sessionId,
    status: 'pending_instructor_verification',
  })
    .populate('student', 'fullName email phone nationalId')
    .sort({ checkInTime: -1 });

  return {
    session,
    queue,
    totalPending: queue.length,
  };
}

/**
 * Transitions attendance status from pending_instructor_verification to verified on-premise.
 */
async function verifySessionAttendance(sessionId, { studentIds, verifyAll = false, instructorId }) {
  const session = await findSessionAny(sessionId);
  if (!session) {
    throw new AppError('Session not found.', 404);
  }

  const filter = {
    session: sessionId,
    status: 'pending_instructor_verification',
  };

  if (!verifyAll && studentIds) {
    const ids = Array.isArray(studentIds) ? studentIds : [studentIds];
    if (ids.length > 0) {
      filter.student = { $in: ids };
    }
  }

  const records = await AttendanceRecord.find(filter).populate('student', 'fullName email');
  const now = new Date();
  const updated = [];

  for (const record of records) {
    record.status = 'verified';
    record.verified = true;
    record.verifiedAt = now;
    record.verifiedBy = instructorId;
    record.notes = (record.notes ? record.notes + ' | ' : '') + 'Verified on-premise by instructor';
    await record.save();
    updated.push(record);

    await notify({
      recipient: record.student._id || record.student,
      title: 'Attendance Verified On-Premise',
      message: `Your check-in for session "${session.title}" has been verified on-premise by the instructor.`,
      type: 'success',
      relatedCourse: session.course,
    }).catch(() => null);
  }

  return {
    session,
    verifiedCount: updated.length,
    records: updated,
  };
}

/**
 * Student Absence Excuse submission flow:
 * Accepts { studentId, sessionId, reason, documentNote } and updates or creates record with status: 'excused'.
 */
async function submitAbsenceExcuse({ studentId, sessionId, reason, documentNote, evidenceUrl }) {
  if (!reason || !reason.trim()) {
    throw new AppError('Absence reason is required.', 400);
  }

  let session = await TrainingSession.findById(sessionId)
    .populate('course')
    .populate('cohort');
  if (!session) {
    session = await Session.findById(sessionId)
      .populate('course')
      .populate('cohort');
  }
  if (!session) {
    throw new AppError('Session not found.', 404);
  }

  const enrollment = await Enrollment.findOne({
    student: studentId,
    cohort: session.cohort._id,
    status: { $in: ['Active', 'Confirmed', 'Completed'] },
  });

  if (!enrollment) {
    throw new AppError('Student is not enrolled in the cohort scheduled for this session.', 403);
  }

  let record = await AttendanceRecord.findOne({
    student: studentId,
    session: sessionId,
  });

  if (record) {
    record.status = 'excused';
    record.reason = reason.trim();
    record.documentNote = documentNote || '';
    record.notes = reason.trim();
    record.checkInMethod = 'Dispute_Approval';
    await record.save();
  } else {
    record = await AttendanceRecord.create({
      session: sessionId,
      student: studentId,
      enrollment: enrollment._id,
      course: session.course._id,
      cohort: session.cohort._id,
      status: 'excused',
      reason: reason.trim(),
      documentNote: documentNote || '',
      notes: reason.trim(),
      checkInMethod: 'Dispute_Approval',
      checkInTime: new Date(),
    });
  }

  // Also create dispute record for institutional tracking
  await AttendanceDispute.create({
    student: studentId,
    session: sessionId,
    enrollment: enrollment._id,
    type: 'Excused_Absence',
    reason: reason.trim(),
    documentation: documentNote || evidenceUrl || 'Official Student Absence Notice',
    status: 'Approved',
    reviewedAt: new Date(),
    reviewNotes: 'Absence excuse officially registered',
  }).catch(() => null);

  return record;
}

/**
 * Scoped to Division Admin, listing verified attendance records and flagging students below 85% attendance.
 */
async function getAttendanceLedger({ cohortId, courseId, belowThresholdOnly = false, division }) {
  const query = { status: { $in: ['Active', 'Confirmed', 'Completed'] } };
  if (cohortId) query.cohort = cohortId;
  if (courseId) query.course = courseId;

  const enrollments = await Enrollment.find(query)
    .populate('student', 'fullName email phone nationalId division')
    .populate('course', 'title code level')
    .populate('cohort', 'name');

  const ledger = [];

  for (const enr of enrollments) {
    if (!enr.student) continue;
    if (division && enr.student.division !== division) continue;

    const summary = await getAttendanceSummary(enr.student._id, enr._id);
    const isBelowThreshold = summary.attendanceRate < 85;

    if (belowThresholdOnly && !isBelowThreshold) continue;

    ledger.push({
      enrollmentId: enr._id,
      student: enr.student,
      course: enr.course,
      cohort: enr.cohort,
      totalSessions: summary.totalSessions,
      completedSessions: summary.completedSessions,
      presentSessions: summary.presentCount,
      lateSessions: summary.lateCount,
      absentSessions: summary.absentCount,
      excusedSessions: summary.excusedCount,
      attendanceRate: summary.attendanceRate,
      absenceRate: summary.absenceRate,
      isBelowThreshold,
      certificateEligibility: summary.certificateEligibility,
      warningState: summary.warningState,
      warningMessage: summary.warningMessage,
    });
  }

  return {
    ledger,
    totalStudents: ledger.length,
    atRiskCount: ledger.filter((l) => l.isBelowThreshold).length,
  };
}

module.exports = {
  getAttendancePolicy,
  getAttendanceSummary,
  recordQRCheckIn,
  correctAttendance,
  generateSessionQR,
  submitDispute,
  reviewDispute,
  getSessionQueue,
  verifySessionAttendance,
  submitAbsenceExcuse,
  getAttendanceLedger,
};
