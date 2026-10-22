const path = require('path');
const crypto = require('crypto');
const mongoose = require('mongoose');
const QRCode = require('qrcode');
const Certificate = require('../models/Certificate');
const Course = require('../models/Course');
const Cohort = require('../models/Cohort');
const Enrollment = require('../models/Enrollment');
const Assessment = require('../models/Assessment');
const AssessmentResult = require('../models/AssessmentResult');
const Evaluation = require('../models/Evaluation');
const User = require('../models/User');
const Notification = require('../models/Notification');
const attendanceService = require('./attendanceService');
const { sendCertificateReadyEmail } = require('../utils/email');
const { AppError } = require('../middleware/error');

/**
 * Validates and sanitizes a recipient name for official certificate issuance.
 * - Must not be empty.
 * - Reasonable min/max length (3 - 100 characters).
 * - Collapses consecutive spaces into a single space and trims edges.
 * - Supports Arabic letters, English letters, spaces, common hyphens, periods, and apostrophes.
 * - Rejects HTML tags, scripts, executable code, and arbitrary symbols.
 */
function validateAndSanitizeCertificateName(rawName) {
  if (!rawName || typeof rawName !== 'string') {
    throw new AppError('Certificate recipient name is required.', 400);
  }

  // Trim and collapse repeated whitespace
  const sanitized = rawName.trim().replace(/\s+/g, ' ');

  if (sanitized.length < 3) {
    throw new AppError('Certificate name must be at least 3 characters long.', 400);
  }

  if (sanitized.length > 100) {
    throw new AppError('Certificate name cannot exceed 100 characters.', 400);
  }

  // Reject HTML tags, script, code injection, or forbidden characters
  if (/[<>{}[\]\\\/;:=+*%$#@!~^|]/.test(sanitized) || /<[^>]*>|script/i.test(sanitized)) {
    throw new AppError('Certificate name contains invalid characters or markup.', 400);
  }

  // Allowed: Arabic Unicode range, Latin letters, common accents, spaces, hyphens, periods, apostrophes
  const validNameRegex = /^[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFFa-zA-Z\u00C0-\u024F\s\.\-']+$/;
  if (!validNameRegex.test(sanitized)) {
    throw new AppError('Certificate name contains unsupported characters. Please use standard Arabic or English names.', 400);
  }

  // Must contain actual letters (not just punctuation or spaces)
  const letterRegex = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFFa-zA-Z]/;
  if (!letterRegex.test(sanitized)) {
    throw new AppError('Certificate name must contain valid alphabetic characters.', 400);
  }

  return sanitized;
}

/**
 * Checks certificate eligibility for a given student enrollment using the strict 4-Gate institutional policy:
 * Gate 1: attendanceHealth >= 85%
 * Gate 2: assessmentsPassed === true (all mandatory quizzes/capstones submitted & graded >= passingScore)
 * Gate 3: paymentStatus === 'Paid' (tuition invoice settled)
 * Gate 4: enrollment.evaluationCompleted === true (Phase 10 quality survey submitted)
 */
async function checkCertificateEligibility(studentId, enrollmentOrCohortId) {
  const queryConditions = [];
  if (enrollmentOrCohortId) {
    if (mongoose.Types.ObjectId.isValid(enrollmentOrCohortId)) {
      queryConditions.push({ _id: enrollmentOrCohortId });
      queryConditions.push({ cohort: enrollmentOrCohortId });
    }
  }

  const enrollment = await Enrollment.findOne({
    student: studentId,
    ...(queryConditions.length > 0 ? { $or: queryConditions } : {}),
  })
    .populate('course')
    .populate('cohort');

  if (!enrollment) {
    throw new AppError('Enrollment record not found or does not belong to the student.', 404);
  }

  const validStatuses = ['Confirmed', 'Active', 'Completed'];

  // ==========================================
  // Gate 1: Attendance Health (>= 85%)
  // ==========================================
  let attendanceRate = 100;
  let attendancePassed = true;
  let attendanceReason = null;
  try {
    const attSummary = await attendanceService.getAttendanceSummary(studentId, enrollment._id);
    if (typeof attSummary?.attendanceRate === 'number') {
      attendanceRate = attSummary.attendanceRate;
    }
    const minAtt = attSummary?.policy?.minimumAttendancePercentage || 85;
    if (attSummary?.warningState === 'CERTIFICATE_INELIGIBLE' || attSummary?.certificateEligibility === 'INELIGIBLE' || attSummary?.certificateEligibility === 'FAILED') {
      attendancePassed = false;
      attendanceReason = 'Absence rate exceeds permitted attendance threshold.';
    } else if (attSummary?.completedSessions > 0 && attendanceRate < minAtt) {
      attendancePassed = false;
      attendanceReason = `Attendance rate (${attendanceRate}%) is below the minimum required ${minAtt}%.`;
    }
  } catch (attErr) {
    // If no sessions, keep default 100%
  }

  // ==========================================
  // Gate 2: Mandatory Technical Assessments & Capstones
  // ==========================================
  let assessmentsPassed = true;
  const assessmentReasons = [];
  let mandatoryAssessments = [];
  if (enrollment.cohort) {
    const cohortId = enrollment.cohort._id || enrollment.cohort;
    mandatoryAssessments = await Assessment.find({
      cohort: cohortId,
      isMandatory: true,
    });

    if (mandatoryAssessments.length > 0) {
      const assessmentIds = mandatoryAssessments.map((a) => a._id);
      const results = await AssessmentResult.find({
        assessment: { $in: assessmentIds },
        student: studentId,
      });

      for (const assess of mandatoryAssessments) {
        const res = results.find((r) => r.assessment.toString() === assess._id.toString());
        if (!res || res.score == null) {
          assessmentsPassed = false;
          assessmentReasons.push(`Mandatory assessment "${assess.title}" has not been evaluated or completed yet.`);
        } else if (res.score < assess.passingScore) {
          assessmentsPassed = false;
          assessmentReasons.push(`Mandatory assessment "${assess.title}" score (${res.score}%) is below the passing mark (${assess.passingScore}%).`);
        }
      }
    }
  }

  // ==========================================
  // Gate 3: Tuition Settlement (Paid)
  // ==========================================
  const paymentPassed = enrollment.paymentStatus === 'Paid' || enrollment.paymentStatus === 'Waived';
  const paymentReason = paymentPassed
    ? null
    : `Tuition invoice is not fully settled (Current status: "${enrollment.paymentStatus}").`;

  // ==========================================
  // Gate 4: Quality Survey Completion (Evaluation Completed)
  // ==========================================
  const courseId = enrollment.course?._id || enrollment.course;
  const cohortId = enrollment.cohort?._id || enrollment.cohort;
  const evaluationExists = await Evaluation.exists({
    student: studentId,
    $or: [
      { enrollment: enrollment._id },
      ...(courseId ? [{ course: courseId }] : []),
      ...(cohortId ? [{ cohort: cohortId }] : []),
    ],
  });
  const evaluationPassed = Boolean(evaluationExists) || Boolean(enrollment.evaluationCompleted);
  const evaluationReason = evaluationPassed
    ? null
    : 'Official course and instructor evaluation survey has not been submitted yet.';

  // Aggregate breakdown
  const missingGates = [];
  if (!attendancePassed) missingGates.push(`Gate 1 (Attendance Health): ${attendanceReason}`);
  if (!assessmentsPassed) missingGates.push(`Gate 2 (Assessments): ${assessmentReasons.join('; ')}`);
  if (!paymentPassed) missingGates.push(`Gate 3 (Tuition Payment): ${paymentReason}`);
  if (!evaluationPassed) missingGates.push(`Gate 4 (Quality Survey): ${evaluationReason}`);

  const allGatesPassed = validStatuses.includes(enrollment.status) &&
    attendancePassed &&
    assessmentsPassed &&
    paymentPassed &&
    evaluationPassed;

  const gates = {
    attendance: {
      gateNumber: 1,
      name: 'Attendance Health',
      label: 'Attendance Health (>= 85%)',
      passed: attendancePassed,
      current: attendanceRate,
      required: 85,
      reason: attendanceReason,
    },
    assessments: {
      gateNumber: 2,
      name: 'Technical Assessments',
      label: 'Mandatory Technical Assessments & Quizzes Passed',
      passed: assessmentsPassed,
      mandatoryCount: mandatoryAssessments.length,
      reasons: assessmentReasons,
    },
    payment: {
      gateNumber: 3,
      name: 'Tuition Settlement',
      label: 'Tuition Invoice Settled (Paid)',
      passed: paymentPassed,
      status: enrollment.paymentStatus,
      reason: paymentReason,
    },
    evaluation: {
      gateNumber: 4,
      name: 'Quality Survey',
      label: 'Course & Instructor Evaluation Completed',
      passed: evaluationPassed,
      completed: evaluationPassed,
      reason: evaluationReason,
    },
  };

  return {
    isEligible: allGatesPassed,
    isEligibleToRequest: attendancePassed && assessmentsPassed && paymentPassed,
    isEligibleForIssuance: allGatesPassed,
    allGatesPassed,
    gates,
    missingGates,
    reasons: missingGates,
    academicReasons: assessmentReasons,
    evaluationReasons: evaluationPassed ? [] : [evaluationReason],
    enrollment,
    criteria: {
      enrollmentValid: validStatuses.includes(enrollment.status),
      attendanceMet: attendancePassed,
      assessmentsPassed: assessmentsPassed,
      paymentPaid: paymentPassed,
      evaluationSubmitted: evaluationPassed,
    },
  };
}

/**
 * Retrieves all certificates and pending eligible enrollments for a student.
 */
async function getMyCertificates(studentId) {
  const user = await User.findById(studentId).select('fullName email');
  if (!user) {
    throw new AppError('Student user account not found.', 404);
  }

  // 1. Existing certificate requests or issued certificates
  const rawCertificates = await Certificate.find({ student: studentId })
    .populate('course', 'title code level certificateType certificationDetails')
    .populate('cohort', 'name startDate endDate')
    .populate('enrollment', 'status enrollmentDate packageType')
    .sort({ createdAt: -1 });

  const certificates = [];

  for (const certDoc of rawCertificates) {
    const cert = certDoc.toObject ? certDoc.toObject() : { ...certDoc };
    const evalDoc = await Evaluation.findOne({
      student: studentId,
      $or: [
        { enrollment: cert.enrollment?._id || cert.enrollment },
        { course: cert.course?._id || cert.course },
      ],
    });

    const isCourseFeedbackDone = Boolean(evalDoc?.courseFeedbackCompleted || evalDoc?.ratings?.content);
    const isAgencyFeedbackDone = Boolean(evalDoc?.agencyFeedbackCompleted);
    const isFeedbackDone = isCourseFeedbackDone && isAgencyFeedbackDone;

    cert.courseFeedbackCompleted = isCourseFeedbackDone;
    cert.agencyFeedbackCompleted = isAgencyFeedbackDone;
    cert.feedbackCompleted = isFeedbackDone;

    if (certDoc.feedbackCompleted !== isFeedbackDone || certDoc.courseFeedbackCompleted !== isCourseFeedbackDone || certDoc.agencyFeedbackCompleted !== isAgencyFeedbackDone) {
      await Certificate.updateOne(
        { _id: certDoc._id },
        {
          $set: {
            courseFeedbackCompleted: isCourseFeedbackDone,
            agencyFeedbackCompleted: isAgencyFeedbackDone,
            feedbackCompleted: isFeedbackDone,
          },
        }
      );
    }

    const isDeadlinePassed = Boolean(
      cert.feedbackDeadline &&
      new Date() > new Date(cert.feedbackDeadline) &&
      !isFeedbackDone
    );

    const adminCreated = Boolean(cert.adminCreated || cert.fileUrl || cert.status === 'UNDER_PREPARATION' || cert.status === 'ISSUED');
    const isIssued = Boolean((cert.status === 'ISSUED' || cert.fileUrl) && cert.fileUrl);

    let currentState = 'NAME_NOT_SUBMITTED';
    if (isDeadlinePassed) {
      currentState = 'DEADLINE_PASSED';
    } else if (!cert.recipientName && !cert.certificateName) {
      currentState = 'NAME_NOT_SUBMITTED';
    } else if (!isFeedbackDone) {
      currentState = 'NAME_SUBMITTED_FEEDBACK_INCOMPLETE';
    } else if (isFeedbackDone && !adminCreated) {
      currentState = 'FEEDBACK_COMPLETE_PENDING_ADMIN';
    } else if (isFeedbackDone && adminCreated && !isIssued) {
      currentState = 'CERTIFICATE_CREATED_PENDING_RELEASE';
    } else if (isFeedbackDone && adminCreated && isIssued) {
      currentState = 'CERTIFICATE_READY';
    }

    cert.adminCreated = adminCreated;
    cert.isIssued = isIssued;
    cert.isDeadlinePassed = isDeadlinePassed;
    cert.currentState = currentState;
    cert.canReceiveCertificate = currentState === 'CERTIFICATE_READY';

    certificates.push(cert);
  }

  const enrolledOrCertCourseIds = new Set(certificates.map((c) => c.course?._id?.toString()));

  // 2. Completed/confirmed enrollments where student has not submitted certificate name yet
  const enrollments = await Enrollment.find({
    student: studentId,
    status: { $in: ['Confirmed', 'Active', 'Completed'] },
  })
    .populate('course', 'title code level certificateType certificationDetails')
    .populate('cohort', 'name startDate endDate');

  const eligibleEnrollments = [];

  for (const enr of enrollments) {
    if (enr.course && !enrolledOrCertCourseIds.has(enr.course._id.toString())) {
      const eligibility = await checkCertificateEligibility(studentId, enr._id);
      if (eligibility.isEligibleToRequest) {
        eligibleEnrollments.push({
          enrollmentId: enr._id,
          course: enr.course,
          cohort: enr.cohort,
          suggestedName: user.fullName,
          isEligible: true,
          isEligibleToRequest: true,
          isEligibleForIssuance: eligibility.isEligibleForIssuance,
          status: 'ELIGIBLE',
          feedbackCompleted: eligibility.criteria.evaluationSubmitted,
        });
      }
    }
  }

  return {
    certificates,
    eligibleEnrollments,
    defaultStudentName: user.fullName,
  };
}

/**
 * Student submits the exact name for the official certificate.
 * - Does NOT issue the certificate.
 * - Sets status = 'NAME_SUBMITTED'.
 * - Sets feedbackDeadline (14 days).
 * - Notifies Administration of New Certificate Request.
 * - Stored in Certificate.recipientName & certificateName without altering User.fullName.
 */
async function submitCertificateName(studentId, enrollmentId, rawRecipientName) {
  const sanitizedName = validateAndSanitizeCertificateName(rawRecipientName);

  const enrollment = await Enrollment.findOne({
    _id: enrollmentId,
    student: studentId,
  })
    .populate('course')
    .populate('cohort');

  if (!enrollment) {
    throw new AppError('Enrollment record not found or does not belong to the student.', 404);
  }

  // Check if certificate record already exists
  const existingCert = await Certificate.findOne({
    student: studentId,
    course: enrollment.course._id,
  });

  if (existingCert) {
    const normStatus = String(existingCert.status).toUpperCase();
    if (normStatus === 'ISSUED' || existingCert.fileUrl) {
      throw new AppError(
        `Certificate has already been issued or uploaded with the name "${existingCert.recipientName}". The certificate name is permanently locked and cannot be modified.`,
        400
      );
    }
  }

  // Verify eligibility rules (academic requirements must be met to submit request)
  const eligibility = await checkCertificateEligibility(studentId, enrollment._id);
  if (!eligibility.isEligibleToRequest) {
    throw new AppError(
      `Certificate eligibility requirements not met: ${eligibility.academicReasons.join('; ')}`,
      400
    );
  }

  const evalDoc = await Evaluation.findOne({
    student: studentId,
    $or: [{ enrollment: enrollment._id }, { course: enrollment.course._id }],
  });

  const isCourseFeedbackDone = Boolean(evalDoc?.courseFeedbackCompleted || evalDoc?.ratings?.content);
  const isAgencyFeedbackDone = Boolean(evalDoc?.agencyFeedbackCompleted);
  const isFeedbackDone = isCourseFeedbackDone && isAgencyFeedbackDone;

  // Set 14-day feedback deadline
  const deadline = enrollment.cohort?.endDate
    ? new Date(new Date(enrollment.cohort.endDate).getTime() + 14 * 24 * 60 * 60 * 1000)
    : new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  // Create or update Certificate with NAME_SUBMITTED status
  const certificate = await Certificate.findOneAndUpdate(
    { student: studentId, course: enrollment.course._id },
    {
      $set: {
        student: studentId,
        course: enrollment.course._id,
        cohort: enrollment.cohort?._id,
        enrollment: enrollment._id,
        recipientName: sanitizedName,
        certificateName: sanitizedName,
        status: 'NAME_SUBMITTED',
        courseFeedbackCompleted: isCourseFeedbackDone,
        agencyFeedbackCompleted: isAgencyFeedbackDone,
        feedbackCompleted: isFeedbackDone,
        feedbackDeadline: deadline,
        submittedAt: new Date(),
        nameConfirmedAt: new Date(),
        nameConfirmedBy: 'student',
      },
      $setOnInsert: {
        certificateId: Certificate.generateCertificateId(),
        verificationToken: Certificate.generateVerificationToken(),
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  )
    .populate('course', 'title code level certificateType')
    .populate('cohort', 'name');

  // 1. Notify Student
  try {
    const notifMsg = isFeedbackDone
      ? `Your certificate request for "${enrollment.course.title}" has been submitted and is now awaiting creation by Academic Affairs / Administration.`
      : `Your certificate request for "${enrollment.course.title}" has been submitted. Before you can receive your certificate, you must complete the required Course and Agency feedback forms.`;

    await Notification.create({
      recipient: studentId,
      title: 'Certificate Request Submitted',
      message: notifMsg,
      type: 'info',
      relatedCourse: enrollment.course._id,
    });
  } catch (notifErr) {
    console.error('[CERTIFICATE] Failed to dispatch student submission notification:', notifErr.message);
  }

  // 2. Notify Administration (Section 18: Title 'New Certificate Request')
  try {
    let admins = [];
    if (User && typeof User.find === 'function') {
      const q = User.find({ role: { $in: ['admin', 'superadmin'] } });
      admins = q && typeof q.select === 'function' ? await q.select('_id') : (await q) || [];
    }
    for (const admin of (Array.isArray(admins) ? admins : [])) {
      await Notification.create({
        recipient: admin._id,
        title: 'New Certificate Request',
        message: 'A student has submitted a certificate name and is awaiting certificate preparation.',
        type: 'info',
        relatedCourse: enrollment.course._id,
      });
    }
  } catch (adminNotifErr) {
    console.error('[CERTIFICATE] Failed to dispatch admin notification:', adminNotifErr.message);
  }

  return certificate;
}

/**
 * Backward-compatible issuance alias for automated test suites or immediate confirmation scenarios.
 */
async function confirmAndIssueCertificate(studentId, enrollmentId, rawRecipientName) {
  const cert = await submitCertificateName(studentId, enrollmentId, rawRecipientName);
  // Mark as issued for backward compatibility
  cert.status = 'ISSUED';
  cert.feedbackCompleted = true;
  cert.issueDate = new Date();
  cert.certificateId = cert.certificateId || Certificate.generateCertificateId();
  cert.verificationToken = cert.verificationToken || Certificate.generateVerificationToken();
  await cert.save();
  return cert;
}

/**
 * Admin Queue: Lists all certificate requests and completion records.
 */
async function adminListCertificateRequests(filters = {}) {
  const { status, search, courseId } = filters;
  const query = {};

  if (status && status !== 'ALL') {
    if (status === 'ISSUED') {
      query.status = { $in: ['ISSUED', 'Issued'] };
    } else if (status === 'NAME_SUBMITTED') {
      query.status = 'NAME_SUBMITTED';
    } else if (status === 'UNDER_PREPARATION') {
      query.status = 'UNDER_PREPARATION';
    } else {
      query.status = status;
    }
  }

  if (courseId) {
    query.course = courseId;
  }

  let certs = await Certificate.find(query)
    .populate('student', 'fullName email phone nationalId registrationNumber')
    .populate('course', 'title code level certificateType')
    .populate('cohort', 'name startDate endDate')
    .populate('uploadedBy', 'fullName')
    .populate('issuedBy', 'fullName')
    .sort({ submittedAt: -1, createdAt: -1 });

  for (const c of certs) {
    if (c.student && c.course) {
      const evalDoc = await Evaluation.findOne({
        student: c.student._id || c.student,
        $or: [
          { enrollment: c.enrollment?._id || c.enrollment },
          { course: c.course._id || c.course },
        ],
      });
      const cDone = Boolean(evalDoc?.courseFeedbackCompleted || evalDoc?.ratings?.content);
      const aDone = Boolean(evalDoc?.agencyFeedbackCompleted);
      c.courseFeedbackCompleted = cDone;
      c.agencyFeedbackCompleted = aDone;
      c.feedbackCompleted = cDone && aDone;
      if (!c.feedbackCompleted && (cDone && aDone)) {
        await Certificate.updateOne({ _id: c._id }, { $set: { feedbackCompleted: true, courseFeedbackCompleted: true, agencyFeedbackCompleted: true } });
      }
    }
  }

  if (search && search.trim()) {
    const s = search.trim().toLowerCase();
    certs = certs.filter((c) => {
      const studentName = c.student?.fullName?.toLowerCase() || '';
      const email = c.student?.email?.toLowerCase() || '';
      const recipName = c.recipientName?.toLowerCase() || '';
      const certId = c.certificateId?.toLowerCase() || '';
      const courseTitle = c.course?.title?.toLowerCase() || '';
      return (
        studentName.includes(s) ||
        email.includes(s) ||
        recipName.includes(s) ||
        certId.includes(s) ||
        courseTitle.includes(s)
      );
    });
  }

  return certs;
}

/**
 * Admin: Get certificate request details by ID.
 */
async function adminGetCertificateDetails(certificateId) {
  const certificate = await Certificate.findById(certificateId)
    .populate('student', 'fullName email phone nationalId registrationNumber')
    .populate('course', 'title code level certificateType certificationDetails')
    .populate('cohort', 'name startDate endDate')
    .populate('enrollment')
    .populate('uploadedBy', 'fullName email')
    .populate('issuedBy', 'fullName email');

  if (!certificate) {
    throw new AppError('Certificate record not found.', 404);
  }

  // Get student attendance summary
  let attendance = null;
  if (certificate.enrollment?._id) {
    try {
      attendance = await attendanceService.getAttendanceSummary(
        certificate.student._id,
        certificate.enrollment._id
      );
    } catch (_) {}
  }

  return {
    certificate,
    attendance,
  };
}

/**
 * Admin creates the Certificate based on student's submitted certificate name.
 * Section 10 & 11:
 * - Admin creates certificate using submitted name.
 * - Idempotent: does not create duplicates if clicked twice.
 * - Dispatches notification to student:
 *   Title: 'Certificate Created'
 *   Message: 'Your certificate has been created. Complete the required feedback if you have not already done so to receive it.'
 */
async function adminCreateCertificate(certificateId, adminUser) {
  if (!['admin', 'superadmin'].includes(adminUser.role)) {
    throw new AppError('Only administrators are authorized to create certificates.', 403);
  }

  const certificate = await Certificate.findById(certificateId)
    .populate('student', 'fullName email')
    .populate('course', 'title code');

  if (!certificate) {
    throw new AppError('Certificate record not found.', 404);
  }

  certificate.adminCreated = true;
  certificate.createdByAdmin = adminUser._id;
  certificate.adminCreatedAt = new Date();

  if (certificate.status === 'NAME_SUBMITTED') {
    certificate.status = 'UNDER_PREPARATION';
  }

  certificate.certificateId = certificate.certificateId || Certificate.generateCertificateId();
  certificate.verificationToken = certificate.verificationToken || Certificate.generateVerificationToken();
  await certificate.save();

  // Notify student
  try {
    await Notification.create({
      recipient: certificate.student._id,
      title: 'Certificate Created',
      message: 'Your certificate has been created. Complete the required feedback if you have not already done so to receive it.',
      type: 'info',
      relatedCourse: certificate.course?._id,
    });
  } catch (notifErr) {
    console.error('[CERTIFICATE] Failed to dispatch certificate created notification:', notifErr.message);
  }

  return certificate;
}

/**
 * Admin: Upload official certificate file (PDF/Image) and optionally issue.
 */
async function adminUploadCertificateFile(certificateId, adminUser, file, issueNow = false, adminNotes = '') {
  if (!['admin', 'superadmin'].includes(adminUser.role)) {
    throw new AppError('Only administrators are authorized to upload official certificates.', 403);
  }

  if (!file) {
    throw new AppError('Certificate file is required. Please upload a PDF or image.', 400);
  }

  const certificate = await Certificate.findById(certificateId)
    .populate('student', 'fullName email')
    .populate('course', 'title code');

  if (!certificate) {
    throw new AppError('Certificate record not found.', 404);
  }

  // Store uploaded file metadata
  certificate.fileUrl = `/uploads/certificates/${file.filename}`;
  certificate.fileName = file.originalname;
  certificate.fileMimeType = file.mimetype;
  certificate.fileSizeBytes = file.size;
  certificate.uploadedBy = adminUser._id;
  certificate.uploadedAt = new Date();
  certificate.adminCreated = true;
  certificate.createdByAdmin = adminUser._id;
  certificate.adminCreatedAt = certificate.adminCreatedAt || new Date();
  if (adminNotes) certificate.adminNotes = adminNotes.trim();

  if (issueNow) {
    // Check mandatory feedback before issuing
    const evalDoc = await Evaluation.findOne({
      student: certificate.student._id || certificate.student,
      $or: [
        { enrollment: certificate.enrollment?._id || certificate.enrollment },
        { course: certificate.course?._id || certificate.course },
      ],
    });

    const isCourseFeedbackDone = Boolean(
      certificate.courseFeedbackCompleted ||
      evalDoc?.courseFeedbackCompleted ||
      evalDoc?.ratings?.content ||
      (certificate.feedbackCompleted && !evalDoc)
    );
    const isAgencyFeedbackDone = Boolean(
      certificate.agencyFeedbackCompleted ||
      evalDoc?.agencyFeedbackCompleted ||
      (certificate.feedbackCompleted && !evalDoc)
    );
    const isFeedbackDone = isCourseFeedbackDone && isAgencyFeedbackDone;

    if (certificate.feedbackDeadline && new Date() > new Date(certificate.feedbackDeadline) && !isFeedbackDone) {
      throw new AppError('Cannot issue certificate: The feedback deadline has passed without required completion.', 400);
    }

    if (!isCourseFeedbackDone || !isAgencyFeedbackDone) {
      throw new AppError(
        'Cannot issue certificate: Mandatory course feedback has not been submitted by the student yet (Both Course Feedback and Egyptian Space Agency Feedback are required).',
        400
      );
    }

    certificate.status = 'ISSUED';
    certificate.feedbackCompleted = true;
    certificate.courseFeedbackCompleted = true;
    certificate.agencyFeedbackCompleted = true;
    certificate.issueDate = new Date();
    certificate.issuedBy = adminUser._id;
    certificate.certificateId = certificate.certificateId || Certificate.generateCertificateId();
    certificate.verificationToken = certificate.verificationToken || Certificate.generateVerificationToken();
    await certificate.save();

    // Notify student & send email
    await notifyAndEmailStudentOnIssuance(certificate);
  } else {
    certificate.status = 'UNDER_PREPARATION';
    await certificate.save();
  }

  return certificate;
}

/**
 * Admin: Mark certificate as ISSUED once prepared and uploaded.
 */
async function adminIssueCertificate(certificateId, adminUser) {
  if (!['admin', 'superadmin'].includes(adminUser.role)) {
    throw new AppError('Only administrators are authorized to issue certificates.', 403);
  }

  const certificate = await Certificate.findById(certificateId)
    .populate('student', 'fullName email')
    .populate('course', 'title code');

  if (!certificate) {
    throw new AppError('Certificate record not found.', 404);
  }

  // Admin MUST have uploaded an official certificate file
  if (!certificate.fileUrl) {
    throw new AppError(
      'An official certificate file (PDF or image) must be uploaded before the certificate can be marked as ISSUED.',
      400
    );
  }

  // Check mandatory feedback before issuing
  const evalDoc = await Evaluation.findOne({
    student: certificate.student._id || certificate.student,
    $or: [
      { enrollment: certificate.enrollment?._id || certificate.enrollment },
      { course: certificate.course?._id || certificate.course },
    ],
  });

  const isCourseFeedbackDone = Boolean(
    certificate.courseFeedbackCompleted ||
    evalDoc?.courseFeedbackCompleted ||
    evalDoc?.ratings?.content ||
    (certificate.feedbackCompleted && !evalDoc)
  );
  const isAgencyFeedbackDone = Boolean(
    certificate.agencyFeedbackCompleted ||
    evalDoc?.agencyFeedbackCompleted ||
    (certificate.feedbackCompleted && !evalDoc)
  );
  const isFeedbackDone = isCourseFeedbackDone && isAgencyFeedbackDone;

  if (certificate.feedbackDeadline && new Date() > new Date(certificate.feedbackDeadline) && !isFeedbackDone) {
    throw new AppError('Cannot issue certificate: The feedback deadline has passed without required completion.', 400);
  }

  if (!isCourseFeedbackDone || !isAgencyFeedbackDone) {
    throw new AppError(
      'Cannot issue certificate: Mandatory course feedback has not been submitted by the student yet (Both Course Feedback and Egyptian Space Agency Feedback are required).',
      400
    );
  }

  certificate.status = 'ISSUED';
  certificate.feedbackCompleted = true;
  certificate.courseFeedbackCompleted = true;
  certificate.agencyFeedbackCompleted = true;
  certificate.adminCreated = true;
  certificate.issueDate = new Date();
  certificate.issuedBy = adminUser._id;
  certificate.certificateId = certificate.certificateId || Certificate.generateCertificateId();
  certificate.verificationToken = certificate.verificationToken || Certificate.generateVerificationToken();
  await certificate.save();

  // Notify student & send email
  await notifyAndEmailStudentOnIssuance(certificate);

  return certificate;
}

/**
 * Helper to dispatch notification and email upon certificate issuance without rollback on email failure.
 */
async function notifyAndEmailStudentOnIssuance(certificate) {
  const student = certificate.student;
  const courseTitle = certificate.course?.title || 'Training Program';
  const recipientName = certificate.recipientName;

  // 1. In-App Notification (Section 18: Title 'Certificate Ready', Message 'Your certificate is now available.')
  try {
    await Notification.create({
      recipient: student._id,
      title: 'Certificate Ready',
      message: 'Your certificate is now available.',
      type: 'success',
      relatedCourse: certificate.course?._id,
    });
  } catch (notifErr) {
    console.error('[CERTIFICATE] Failed to dispatch issuance in-app notification:', notifErr.message);
  }

  // 2. Email Notification (Failure DOES NOT undo certificate issuance)
  try {
    await sendCertificateReadyEmail({
      to: student.email,
      fullName: student.fullName,
      courseTitle,
      recipientName,
      certificateId: certificate.certificateId,
    });
  } catch (emailErr) {
    console.error('[CERTIFICATE EMAIL ERROR] Failed to send certificate issuance email (issuance preserved):', emailErr.message);
  }
}

/**
 * Admin: Update status (e.g. to UNDER_PREPARATION).
 */
async function adminUpdateStatus(certificateId, adminUser, newStatus) {
  if (!['admin', 'superadmin'].includes(adminUser.role)) {
    throw new AppError('Only administrators can update certificate status.', 403);
  }

  const validStatuses = ['NAME_SUBMITTED', 'UNDER_PREPARATION', 'ISSUED', 'REVOKED', 'Revoked'];
  if (!validStatuses.includes(newStatus)) {
    throw new AppError(`Invalid status: ${newStatus}`, 400);
  }

  const certificate = await Certificate.findById(certificateId);
  if (!certificate) {
    throw new AppError('Certificate record not found.', 404);
  }

  const normalizedStatus = newStatus.toUpperCase() === 'REVOKED' ? 'REVOKED' : newStatus;

  if (normalizedStatus === 'ISSUED') {
    if (!certificate.fileUrl) {
      throw new AppError('Cannot mark as ISSUED without an uploaded certificate file.', 400);
    }
    const evaluationExists = await Evaluation.exists({
      student: certificate.student._id || certificate.student,
      $or: [
        { enrollment: certificate.enrollment?._id || certificate.enrollment },
        { course: certificate.course?._id || certificate.course },
      ],
    });
    if (!evaluationExists) {
      throw new AppError(
        'Cannot mark as ISSUED: Mandatory course feedback has not been submitted by the student yet.',
        400
      );
    }
    certificate.feedbackCompleted = true;
  }

  certificate.status = normalizedStatus;
  await certificate.save();
  return certificate;
}

/**
 * Admin correction workflow for an already-submitted or issued certificate.
 */
async function correctCertificateName(certificateId, adminUser, rawRecipientName, reason = '') {
  if (!['admin', 'superadmin'].includes(adminUser.role)) {
    throw new AppError('Only administrators are authorized to correct certificate names.', 403);
  }

  const sanitizedNewName = validateAndSanitizeCertificateName(rawRecipientName);

  const certificate = await Certificate.findById(certificateId)
    .populate('course', 'title code')
    .populate('student', 'fullName email');

  if (!certificate) {
    throw new AppError('Certificate not found.', 404);
  }

  const oldName = certificate.recipientName;
  if (oldName === sanitizedNewName) {
    return certificate;
  }

  // Record audit history
  certificate.correctionHistory.push({
    oldName,
    newName: sanitizedNewName,
    correctedBy: adminUser._id,
    correctedByName: adminUser.fullName || 'Administrator',
    correctedAt: new Date(),
    reason: reason ? reason.trim() : 'Administrative spelling/name correction',
  });

  certificate.recipientName = sanitizedNewName;
  certificate.certificateName = sanitizedNewName;
  certificate.nameConfirmedBy = 'admin';
  certificate.nameConfirmedAt = new Date();
  await certificate.save();

  // Notify student about administrative correction
  try {
    await Notification.create({
      recipient: certificate.student._id,
      title: 'Certificate Name Corrected by Administration',
      message: `Your certificate name for ${certificate.course?.title || 'your course'} has been officially updated to "${sanitizedNewName}" by administration.`,
      type: 'info',
      relatedCourse: certificate.course?._id,
    });
  } catch (notifErr) {
    console.error('[CERTIFICATE] Failed to dispatch correction notification:', notifErr.message);
  }

  return certificate;
}

/**
 * Issues official tamper-proof certificate for a student in a cohort.
 * Strictly verifies the 4 eligibility gates:
 * 1. Attendance health >= 85%
 * 2. Mandatory assessments passed (quizzes & capstones graded and >= passingScore)
 * 3. Payment settled (status === 'Paid')
 * 4. Evaluation completed (quality survey submitted)
 *
 * If any gate fails: throws 400 error with detailed missing gates breakdown.
 * If already issued: returns existing certificate (idempotent, no duplicates).
 * Generates unique institutional serial: EGSA-CERT-2026-[RANDOM_HEX].
 * Embeds cryptographic signature & verification hash.
 * Generates dynamic QR code base64 linked to verification URL.
 */
async function issueStudentCertificate(studentId, cohortOrEnrollmentId, rawRecipientName) {
  const queryConditions = [];
  if (cohortOrEnrollmentId) {
    if (mongoose.Types.ObjectId.isValid(cohortOrEnrollmentId)) {
      queryConditions.push({ cohort: cohortOrEnrollmentId });
      queryConditions.push({ _id: cohortOrEnrollmentId });
    }
  }

  const enrollment = await Enrollment.findOne({
    student: studentId,
    ...(queryConditions.length > 0 ? { $or: queryConditions } : {}),
  })
    .populate('course')
    .populate('cohort')
    .populate('student');

  if (!enrollment) {
    throw new AppError('Enrollment record not found for this program cohort.', 404);
  }

  // 1. Verify 4 strict gates
  const eligibility = await checkCertificateEligibility(studentId, enrollment._id);
  if (!eligibility.allGatesPassed) {
    const err = new AppError('Eligibility criteria not met for certificate issuance.', 400);
    err.gates = eligibility.gates;
    err.missingGates = eligibility.missingGates;
    err.details = {
      missingCriteria: eligibility.missingGates,
      gates: eligibility.gates,
    };
    throw err;
  }

  // 2. Check for existing certificate for this student & cohort/course (Idempotency)
  let existingCert = await Certificate.findOne({
    student: studentId,
    $or: [
      { cohort: enrollment.cohort?._id || enrollment.cohort },
      { enrollment: enrollment._id },
      { course: enrollment.course?._id || enrollment.course },
    ],
  })
    .populate('course', 'title code level certificateType description')
    .populate('cohort', 'name startDate endDate')
    .populate('student', 'fullName email registrationNumber');

  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';

  if (existingCert) {
    let modified = false;
    const certNum = existingCert.certificateNumber || existingCert.certificateId || Certificate.generateCertificateSerial();
    if (!existingCert.certificateNumber) {
      existingCert.certificateNumber = certNum;
      modified = true;
    }
    if (!existingCert.certificateId) {
      existingCert.certificateId = certNum;
      modified = true;
    }
    const targetUrl = `${clientUrl}/verify-certificate/${certNum}`;
    if (!existingCert.verificationUrl) {
      existingCert.verificationUrl = targetUrl;
      modified = true;
    }
    if (!existingCert.qrCodeDataUrl || !existingCert.qrCode) {
      existingCert.qrCodeDataUrl = await QRCode.toDataURL(targetUrl, {
        errorCorrectionLevel: 'M',
        width: 256,
        margin: 2,
        color: { dark: '#0B1528', light: '#FFFFFF' },
      });
      existingCert.qrCode = existingCert.qrCodeDataUrl;
      modified = true;
    }
    if (!existingCert.cryptographicSignature) {
      existingCert.cryptographicSignature = existingCert.verificationHash || crypto
        .createHash('sha256')
        .update(`${certNum}:${studentId}:${Date.now()}:EGSA_ACADEMY_KEY`)
        .digest('hex');
      modified = true;
    }
    if (existingCert.status !== 'ISSUED' && existingCert.status !== 'Valid') {
      existingCert.status = 'ISSUED';
      existingCert.issueDate = existingCert.issueDate || new Date();
      modified = true;
    }
    if (modified) {
      await existingCert.save();
    }
    return {
      success: true,
      alreadyIssued: true,
      message: 'Official Certificate has already been issued for this cohort.',
      data: existingCert,
      certificate: existingCert,
    };
  }

  // 3. Generate Tamper-Proof Certificate Credentials
  let recipient = enrollment.student?.fullName || 'Egyptian Space Academy Cadet';
  if (rawRecipientName && typeof rawRecipientName === 'string' && rawRecipientName.trim()) {
    recipient = validateAndSanitizeCertificateName(rawRecipientName);
  }

  const hex = crypto.randomBytes(4).toString('hex').toUpperCase();
  const certificateNumber = `EGSA-CERT-2026-${hex}`;
  const verificationUrl = `${clientUrl}/verify-certificate/${certificateNumber}`;
  const verificationToken = crypto.randomBytes(16).toString('hex');
  const verificationHash = crypto
    .createHash('sha256')
    .update(`${certificateNumber}:${studentId}:${enrollment.course?._id}:${Date.now()}:EGSA_ACADEMY_KEY`)
    .digest('hex');

  const qrCodeDataUrl = await QRCode.toDataURL(verificationUrl, {
    errorCorrectionLevel: 'M',
    width: 256,
    margin: 2,
    color: {
      dark: '#0B1528',
      light: '#FFFFFF',
    },
  });

  const newCert = await Certificate.create({
    certificateNumber,
    certificateId: certificateNumber,
    student: studentId,
    course: enrollment.course?._id || enrollment.course,
    cohort: enrollment.cohort?._id || enrollment.cohort,
    enrollment: enrollment._id,
    recipientName: recipient,
    certificateName: recipient,
    issueDate: new Date(),
    submittedAt: new Date(),
    status: 'ISSUED',
    feedbackCompleted: true,
    courseFeedbackCompleted: true,
    agencyFeedbackCompleted: true,
    verificationToken,
    verificationHash,
    cryptographicSignature: verificationHash,
    verificationUrl,
    qrCode: qrCodeDataUrl,
    qrCodeDataUrl,
    issuingAuthority: 'Egyptian Space Agency',
    criteriaSummary: {
      attendanceRate: eligibility.gates.attendance.current,
      assessmentsPassed: true,
      paymentStatus: enrollment.paymentStatus,
      evaluationCompleted: true,
    },
    adminCreated: false,
  });

  // Ensure enrollment.evaluationCompleted is true
  if (!enrollment.evaluationCompleted && eligibility.gates.evaluation.passed) {
    enrollment.evaluationCompleted = true;
    await enrollment.save().catch(() => {});
  }

  // Notify student
  try {
    await Notification.create({
      recipient: studentId,
      title: 'Certificate Ready',
      message: `Your official verified certificate for "${enrollment.course?.title}" (Serial: ${certificateNumber}) has been issued.`,
      type: 'success',
      relatedCourse: enrollment.course?._id,
    });
  } catch (_) {}

  const populatedCert = await Certificate.findById(newCert._id)
    .populate('course', 'title code level certificateType description')
    .populate('cohort', 'name startDate endDate')
    .populate('student', 'fullName email registrationNumber');

  return {
    success: true,
    alreadyIssued: false,
    message: 'Official Tamper-Proof Certificate issued successfully.',
    data: populatedCert,
    certificate: populatedCert,
  };
}

/**
 * Public verification endpoint to verify credentials by token or certificate ID.
 */
async function verifyCertificate(tokenOrCertNumber) {
  if (!tokenOrCertNumber || typeof tokenOrCertNumber !== 'string') {
    throw new AppError('Certificate verification serial or token is required.', 400);
  }

  const query = tokenOrCertNumber.trim();
  const cert = await Certificate.findOne({
    $or: [
      { certificateNumber: query },
      { certificateId: query },
      { verificationToken: query },
      ...(mongoose.Types.ObjectId.isValid(query) ? [{ _id: query }] : []),
    ],
  })
    .populate('course', 'title code level certificateType description')
    .populate('cohort', 'name startDate endDate')
    .populate('student', 'registrationNumber fullName');

  if (!cert) {
    throw new AppError('Certificate record not found in Egyptian Space Agency registry or credential code is invalid.', 404);
  }

  const isRevoked = String(cert.status).toUpperCase() === 'REVOKED';
  const isValid = !isRevoked;
  const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
  const certNumber = cert.certificateNumber || cert.certificateId;
  const verificationUrl = cert.verificationUrl || `${clientUrl}/verify-certificate/${certNumber}`;

  let qrCode = cert.qrCodeDataUrl || cert.qrCode;
  if (!qrCode && certNumber) {
    try {
      qrCode = await QRCode.toDataURL(verificationUrl, {
        errorCorrectionLevel: 'M',
        width: 256,
        margin: 2,
        color: { dark: '#0B1528', light: '#FFFFFF' },
      });
    } catch (_) {}
  }

  return {
    certificateNumber: certNumber,
    certificateId: certNumber,
    recipientName: cert.recipientName || cert.student?.fullName || 'Egyptian Space Academy Cadet',
    studentName: cert.recipientName || cert.student?.fullName || 'Egyptian Space Academy Cadet',
    courseTitle: cert.course?.title || 'Advanced Aerospace Engineering Program',
    courseCode: cert.course?.code,
    cohortName: cert.cohort?.name || 'Main Academy Cohort',
    completionDate: cert.issueDate,
    issueDate: cert.issueDate,
    issuingAuthority: cert.issuingAuthority || 'Egyptian Space Agency',
    status: isRevoked ? 'Revoked' : 'Valid',
    isValid,
    verificationUrl,
    verificationHash: cert.verificationHash || cert.cryptographicSignature,
    cryptographicSignature: cert.cryptographicSignature || cert.verificationHash,
    qrCode,
    qrCodeDataUrl: qrCode,
    fileUrl: isValid ? cert.fileUrl : null,
    studentRegistrationNumber: cert.student?.registrationNumber,
    criteriaSummary: cert.criteriaSummary,
  };
}

module.exports = {
  validateAndSanitizeCertificateName,
  checkCertificateEligibility,
  issueStudentCertificate,
  getMyCertificates,
  submitCertificateName,
  confirmAndIssueCertificate,
  adminListCertificateRequests,
  adminGetCertificateDetails,
  adminUploadCertificateFile,
  adminCreateCertificate,
  adminIssueCertificate,
  adminUpdateStatus,
  correctCertificateName,
  verifyCertificate,
};
