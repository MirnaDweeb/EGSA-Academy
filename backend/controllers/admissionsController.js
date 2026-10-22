const Application = require('../models/Application');
const Course = require('../models/Course');
const Cohort = require('../models/Cohort');
const StudentProfile = require('../models/StudentProfile');
const Invoice = require('../models/Invoice');
const ReadinessAttempt = require('../models/ReadinessAttempt');
const { evaluateEligibility } = require('../services/eligibilityService');
const { autoAcceptAndReserveSeat } = require('../services/admissionService');
const { scoreAttempt } = require('../services/readinessService');
const { notify } = require('../services/notificationService');
const { sendApplicationSubmittedEmail } = require('../utils/email');
const { AppError } = require('../middleware/error');
const AuditLog = require('../models/AuditLog');
const { recordAudit } = require('../services/auditService');

/**
 * POST /api/admissions/check-eligibility
 * Compares the logged-in student's StudentProfile against the target course requirements.
 */
async function checkEligibility(req, res, next) {
  try {
    const { courseId } = req.body;
    if (!courseId) throw new AppError('Course ID is required.', 400);

    const course = await Course.findById(courseId).populate('prerequisites mandatoryPrerequisites');
    if (!course) throw new AppError('Course not found.', 404);

    let profile = await StudentProfile.findOne({ user: req.user._id });
    if (!profile) {
      // Auto-initialize minimal profile if missing so evaluation does not fail
      profile = await StudentProfile.create({
        user: req.user._id,
        status: 'student',
        university: req.user.division === 'PRE_UNIVERSITY' ? 'Pre-University Division' : 'General Space Academy Cadet',
        faculty: 'Academy Cadet Corps',
        division: req.user.division || 'UNIVERSITY',
        profileCompleted: false,
      });
    }

    const evaluation = await evaluateEligibility(req.user, profile, course);

    res.json({
      success: true,
      data: {
        isEligible: evaluation.isEligible,
        status: evaluation.status,
        eligibilityStatus: evaluation.status,
        divisionMatch: evaluation.divisionMatch,
        studentDivision: evaluation.studentDivision,
        courseDivision: evaluation.courseDivision,
        missingRequirements: evaluation.missingRequirements,
        reasons: evaluation.reasons,
        recommendedCourse: evaluation.recommendedCourse,
        actionableNextSteps: evaluation.actionableNextSteps,
        requiresReadiness: evaluation.requiresReadiness,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admissions/apply
 * Creates the application record with computed eligibility status and returns actionable next steps.
 */
async function apply(req, res, next) {
  try {
    const { courseId, cohortId, packageType } = req.body;
    if (!courseId) throw new AppError('Course ID is required.', 400);

    const course = await Course.findById(courseId).populate('prerequisites mandatoryPrerequisites');
    if (!course) throw new AppError('Course not found.', 404);

    let profile = await StudentProfile.findOne({ user: req.user._id });
    if (!profile) {
      profile = await StudentProfile.create({
        user: req.user._id,
        status: 'student',
        university: req.user.division === 'PRE_UNIVERSITY' ? 'Pre-University Division' : 'General Space Academy Cadet',
        faculty: 'Academy Cadet Corps',
        division: req.user.division || 'UNIVERSITY',
        profileCompleted: false,
      });
    }

    const evaluation = await evaluateEligibility(req.user, profile, course);

    // Prevent duplicate active applications
    let existingApp = await Application.findOne({
      student: req.user._id,
      course: course._id,
      status: { $nin: ['Cancelled', 'Withdrawn', 'Rejected'] },
    }).sort({ createdAt: -1 });

    if (existingApp) {
      // Update with latest computed eligibility status and missing requirements
      existingApp.eligibilityStatus = evaluation.status;
      existingApp.missingRequirements = evaluation.missingRequirements;
      if (['Draft', 'Submitted'].includes(existingApp.status)) {
        existingApp.status = evaluation.status;
      }
      await existingApp.save();

      let invoice = null;
      if (['Accepted', 'Eligible - Payment Pending', 'Confirmed'].includes(existingApp.status)) {
        invoice = await Invoice.findOne({ application: existingApp._id, status: { $ne: 'Cancelled' } });
      }

      return res.status(200).json({
        success: true,
        data: existingApp,
        eligibility: evaluation,
        actionableNextSteps: evaluation.actionableNextSteps,
        invoice,
        message: 'Active application already exists for this program.',
      });
    }

    // Resolve Cohort
    let cohort = null;
    if (cohortId) {
      cohort = await Cohort.findById(cohortId);
    }
    if (!cohort) {
      cohort = await Cohort.findOne({ course: course._id, status: { $in: ['Scheduled', 'InProgress'] } }).sort({ startDate: 1 });
    }

    let application = await Application.create({
      student: req.user._id,
      course: course._id,
      cohort: cohort ? cohort._id : undefined,
      status: evaluation.status,
      eligibilityStatus: evaluation.status,
      missingRequirements: evaluation.missingRequirements,
      selectedPackage: packageType || 'WITHOUT_TRANSPORTATION',
      statusHistory: [
        {
          status: evaluation.status,
          note: `Application submitted. Initial eligibility status evaluated as '${evaluation.status}'.`,
          changedAt: new Date(),
        },
      ],
      submittedAt: new Date(),
    });

    // Send application acknowledgement email
    try {
      await sendApplicationSubmittedEmail({
        to: req.user.email,
        fullName: req.user.fullName,
        courseTitle: course.title,
        applicationNumber: application.referenceNumber,
        preferredLanguage: req.user.preferredLanguage || 'en',
      });
    } catch (_) {}

    // In-app notification
    try {
      await notify({
        recipient: req.user._id,
        title: `Application Registered — ${evaluation.status}`,
        message: evaluation.isEligible
          ? `Your application for ${course.title} has been evaluated as Eligible.`
          : `Your application for ${course.title} is currently marked as ${evaluation.status}.`,
        type: evaluation.isEligible ? 'success' : 'info',
        relatedCourse: course._id,
        relatedApplication: application._id,
      });
    } catch (_) {}

    // If fully eligible, auto-accept and reserve seat if cohort is available
    let invoice = null;
    if (evaluation.isEligible) {
      try {
        const admissionRes = await autoAcceptAndReserveSeat({
          application,
          studentId: req.user._id,
          courseId: course._id,
          cohortId: cohort ? cohort._id : undefined,
          packageType: packageType || 'WITHOUT_TRANSPORTATION',
        });
        if (admissionRes?.application) {
          application = admissionRes.application;
        }
        invoice = admissionRes?.invoice || null;
      } catch (reserveErr) {
        console.error('[ADMISSIONS] autoAcceptAndReserveSeat notice:', reserveErr.message);
      }
    }

    res.status(201).json({
      success: true,
      data: application,
      eligibility: evaluation,
      invoice,
      actionableNextSteps: evaluation.actionableNextSteps,
      message: evaluation.isEligible
        ? 'Application registered and verified as eligible.'
        : `Application registered with status '${evaluation.status}'. Action required.`,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admissions/admin/applications
 * Division-scoped list of applications for Division Admins.
 */
async function listApplicationsForDivisionAdmin(req, res, next) {
  try {
    const scopeDivision = req.scopeDivision;
    const filter = {};

    // Strict division filter if admin is scoped
    if (scopeDivision && scopeDivision !== 'all') {
      const coursesInDivision = await Course.find({ division: scopeDivision }).select('_id');
      const courseIds = coursesInDivision.map((c) => c._id);
      if (req.query.courseId) {
        if (courseIds.some((id) => String(id) === String(req.query.courseId))) {
          filter.course = req.query.courseId;
        } else {
          filter.course = { $in: [] };
        }
      } else {
        filter.course = { $in: courseIds };
      }
    } else if (req.query.courseId) {
      filter.course = req.query.courseId;
    }

    if (req.query.status) {
      filter.status = req.query.status;
    }
    if (req.query.eligibilityStatus) {
      filter.eligibilityStatus = req.query.eligibilityStatus;
    }

    const applications = await Application.find(filter)
      .populate('student', 'fullName email phone nationalId registrationNumber division')
      .populate('course', 'title level category division price basePrice prerequisites')
      .populate('cohort', 'name startDate endDate capacity seatsTaken')
      .populate('adminOverride.adminId', 'fullName email')
      .sort({ createdAt: -1 });

    // Enrich with student profiles for institution/faculty data
    const studentUserIds = applications.map((a) => a.student?._id).filter(Boolean);
    const profiles = await StudentProfile.find({ user: { $in: studentUserIds } });
    const profileMap = new Map(profiles.map((p) => [String(p.user), p]));

    const enriched = applications
      .filter((app) => {
        if (!scopeDivision || scopeDivision === 'all') return true;
        return app.course?.division === scopeDivision;
      })
      .map((app) => {
        const plain = typeof app.toObject === 'function' ? app.toObject() : app;
        const studentId = app.student?._id ? String(app.student._id) : String(app.student);
        const prof = profileMap.get(studentId) || null;
        plain.studentProfile = prof
          ? {
              university: prof.university,
              faculty: prof.faculty,
              department: prof.department,
              academicYear: prof.academicYear,
              division: prof.division,
            }
          : null;
        return plain;
      });

    res.json({
      success: true,
      data: enriched,
      scopeDivision: scopeDivision || 'all',
      count: enriched.length,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH or POST /api/admissions/admin/applications/:id/override
 * Division Admin approves override with mandatory reason text (min 10 chars), stamps Admin ID, and logs immutable AuditLog.
 */
async function approveOverride(req, res, next) {
  try {
    const { id } = req.params;
    const { reason, targetStatus } = req.body;

    if (!reason || typeof reason !== 'string' || reason.trim().length < 10) {
      throw new AppError('An override justification reason (minimum 10 characters) is mandatory to approve an exception.', 400);
    }

    const application = await Application.findById(id)
      .populate('student')
      .populate('course')
      .populate('cohort');

    if (!application) throw new AppError('Application not found.', 404);

    // Division scope guard
    const scopeDivision = req.scopeDivision;
    if (scopeDivision && scopeDivision !== 'all' && application.course?.division !== scopeDivision) {
      throw new AppError('You do not have administrative authority over courses in this division.', 403);
    }

    const previousStatus = application.status;
    const newStatus = targetStatus === 'Accepted' ? 'Accepted' : 'Eligible';

    application.adminOverride = {
      applied: true,
      reason: reason.trim(),
      adminId: req.user._id,
      overriddenAt: new Date(),
    };
    application.status = newStatus;
    application.eligibilityStatus = newStatus;
    application.statusHistory = application.statusHistory || [];
    application.statusHistory.push({
      status: newStatus,
      note: `Admin Override Approved by ${req.user.fullName}: ${reason.trim()}`,
      changedAt: new Date(),
    });

    await application.save();

    // Create immutable AuditLog record
    await recordAudit({
      actor: req.user._id,
      user: req.user._id,
      action: 'ADMIN_OVERRIDE',
      entity: 'Application',
      resource: 'Application',
      entityId: application._id,
      resourceId: application._id,
      division: application.course?.division || scopeDivision,
      before: { status: previousStatus },
      after: { status: newStatus },
      details: {
        previousStatus,
        newStatus,
        reason: reason.trim(),
      },
      reason: reason.trim(),
    });

    // Proceed to seat reservation
    let admissionRes = null;
    try {
      admissionRes = await autoAcceptAndReserveSeat({ application });
    } catch (_) {}

    // Notify student
    try {
      await notify({
        recipient: application.student._id,
        title: 'Application Override Approved',
        message: `Your application for ${application.course?.title} has received an Academic Affairs administrative override.`,
        type: 'success',
        relatedCourse: application.course?._id,
        relatedApplication: application._id,
      });
    } catch (_) {}

    res.json({
      success: true,
      data: admissionRes?.application || application,
      invoice: admissionRes?.invoice || null,
      message: 'Admin override approved successfully. Candidate marked as Eligible.',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH or POST /api/admissions/admin/applications/:id/request-info
 * Division Admin requests more information from student and creates audit log.
 */
async function requestMoreInfo(req, res, next) {
  try {
    const { id } = req.params;
    const note = req.body.note || req.body.message || req.body.reason || '';

    if (!note || !note.trim()) {
      throw new AppError('Please provide details on what additional information is required.', 400);
    }

    const application = await Application.findById(id).populate('student course');
    if (!application) throw new AppError('Application not found.', 404);

    const scopeDivision = req.scopeDivision;
    if (scopeDivision && scopeDivision !== 'all' && application.course?.division !== scopeDivision) {
      throw new AppError('You do not have administrative authority over courses in this division.', 403);
    }

    const previousStatus = application.status;
    application.status = 'Needs Information';
    if (req.body.missingItem || req.body.requiredItem) {
      const item = req.body.missingItem || req.body.requiredItem;
      application.missingRequirements = application.missingRequirements || [];
      if (!application.missingRequirements.includes(item)) {
        application.missingRequirements.push(item);
      }
    }
    application.statusHistory = application.statusHistory || [];
    application.statusHistory.push({
      status: 'Needs Information',
      note: `Info requested by ${req.user.fullName}: ${note.trim()}`,
      changedAt: new Date(),
    });

    await application.save();

    await recordAudit({
      actor: req.user._id,
      user: req.user._id,
      action: 'REQUEST_INFO',
      entity: 'Application',
      resource: 'Application',
      entityId: application._id,
      resourceId: application._id,
      division: application.course?.division || scopeDivision,
      before: { status: previousStatus },
      after: { status: 'Needs Information' },
      details: {
        previousStatus,
        newStatus: 'Needs Information',
        reason: note.trim(),
        missingRequirements: application.missingRequirements,
      },
      reason: note.trim(),
    });

    try {
      await notify({
        recipient: application.student._id,
        title: 'Additional Information Requested',
        message: `Admissions requires further details for your application to ${application.course?.title}: ${note.trim()}`,
        type: 'warning',
        relatedCourse: application.course?._id,
        relatedApplication: application._id,
      });
    } catch (_) {}

    res.json({
      success: true,
      data: application,
      message: 'Information request recorded and dispatched to cadet.',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * PATCH or POST /api/admissions/admin/applications/:id/reject
 * Division Admin rejects application with reason and logs in AuditLog.
 */
async function rejectApplication(req, res, next) {
  try {
    const { id } = req.params;
    const reason = req.body.reason || req.body.message || req.body.rejectionReason;

    if (!reason || !reason.trim()) {
      throw new AppError('A formal rejection justification reason is required.', 400);
    }

    const rejectionReason = reason.trim();
    const application = await Application.findById(id).populate('student course');
    if (!application) throw new AppError('Application not found.', 404);

    const scopeDivision = req.scopeDivision;
    if (scopeDivision && scopeDivision !== 'all' && application.course?.division !== scopeDivision) {
      throw new AppError('You do not have administrative authority over courses in this division.', 403);
    }

    const previousStatus = application.status;
    application.status = 'Rejected';
    application.eligibilityStatus = 'Rejected';
    application.rejectionReason = rejectionReason;
    application.statusHistory = application.statusHistory || [];
    application.statusHistory.push({
      status: 'Rejected',
      note: `Application rejected by ${req.user.fullName}: ${rejectionReason}`,
      changedAt: new Date(),
    });

    await application.save();

    await recordAudit({
      actor: req.user._id,
      user: req.user._id,
      action: 'REJECT_APPLICATION',
      entity: 'Application',
      resource: 'Application',
      entityId: application._id,
      resourceId: application._id,
      division: application.course?.division || scopeDivision,
      before: { status: previousStatus },
      after: { status: 'Rejected' },
      details: {
        previousStatus,
        newStatus: 'Rejected',
        reason: rejectionReason,
      },
      reason: rejectionReason,
    });

    try {
      await notify({
        recipient: application.student._id,
        title: 'Application Status Update',
        message: `Your application for ${application.course?.title} was not accepted: ${rejectionReason}`,
        type: 'danger',
        relatedCourse: application.course?._id,
        relatedApplication: application._id,
      });
    } catch (_) {}

    res.json({
      success: true,
      data: application,
      message: 'Application rejected.',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/admissions/admin/audit-logs
 * Returns division-scoped audit trail of administrative actions for transparency.
 */
async function getAuditLogsForDivisionAdmin(req, res, next) {
  try {
    const scopeDivision = req.scopeDivision;
    const filter = {};

    if (scopeDivision && scopeDivision !== 'all') {
      filter.division = scopeDivision;
    }
    if (req.query.action) {
      filter.action = req.query.action;
    }
    if (req.query.entity || req.query.resource) {
      const ent = req.query.entity || req.query.resource;
      filter.$or = [{ entity: ent }, { resource: ent }];
    }

    const auditLogs = await AuditLog.find(filter)
      .populate('user', 'fullName email role division')
      .populate('actor', 'fullName email role division')
      .sort({ timestamp: -1, _id: -1 })
      .limit(100)
      .lean();

    res.json({
      success: true,
      count: auditLogs.length,
      data: auditLogs,
      scopeDivision: scopeDivision || 'all',
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admissions/start-flow
 * Takes { courseId, cohortId }, verifies prerequisites, provisions or updates draft Application,
 * and returns eligibility status + readiness question pool in a single round-trip.
 */
async function startFlow(req, res, next) {
  try {
    const { courseId, cohortId } = req.body;
    if (!courseId) throw new AppError('courseId is required.', 400);

    const course = await Course.findById(courseId).populate('prerequisites mandatoryPrerequisites recommendedPreviousCourses');
    if (!course) throw new AppError('Course not found.', 404);

    let profile = await StudentProfile.findOne({ user: req.user._id });
    if (!profile) {
      profile = await StudentProfile.create({
        user: req.user._id,
        status: 'student',
        division: req.user.division || 'UNIVERSITY',
        university: req.user.division === 'PRE_UNIVERSITY' ? 'Pre-University Division' : 'General Space Academy Cadet',
        faculty: 'Academy Cadet Corps',
        profileCompleted: false,
      });
    }

    const evaluation = await evaluateEligibility(req.user, profile, course);

    // Find or create/update Application
    let application = await Application.findOne({
      student: req.user._id,
      course: course._id,
      status: { $nin: ['Cancelled', 'Withdrawn', 'Rejected'] },
    }).sort({ createdAt: -1 });

    if (!application) {
      application = await Application.create({
        student: req.user._id,
        course: course._id,
        cohort: cohortId || undefined,
        status: evaluation.status,
        eligibilityStatus: evaluation.status,
        missingRequirements: evaluation.missingRequirements,
        packageType: 'Course Only',
        selectedPackage: 'WITHOUT_TRANSPORTATION',
        submittedAt: new Date(),
      });
    } else {
      application.eligibilityStatus = evaluation.status;
      application.missingRequirements = evaluation.missingRequirements;
      if (['Draft', 'Submitted'].includes(application.status)) {
        application.status = evaluation.status;
      }
      if (cohortId) application.cohort = cohortId;
      await application.save();
    }

    // Resolve or provision Readiness Question Pool & InProgress Attempt
    let attempt = await ReadinessAttempt.findOne({
      student: req.user._id,
      course: course._id,
      status: 'InProgress',
    }).populate('questions');

    if (!attempt || !attempt.questions?.length) {
      const { getQuestionsForCourse } = require('./readinessController');
      const questions = typeof getQuestionsForCourse === 'function'
        ? await getQuestionsForCourse(course)
        : [];

      attempt = await ReadinessAttempt.create({
        student: req.user._id,
        course: course._id,
        application: application._id,
        questions: questions.map((q) => q._id),
        status: 'InProgress',
      });
      attempt = await ReadinessAttempt.findById(attempt._id).populate('questions');
    }

    let questionsForClient = [];
    if (attempt && Array.isArray(attempt.questions)) {
      questionsForClient = attempt.questions.map((q) => ({
        id: q._id,
        questionId: q._id,
        questionText: q.questionText || q.question,
        question: q.questionText || q.question,
        options: q.options,
        topic: q.topic,
        difficulty: q.difficulty || 'Medium',
        weight: q.weight || 1,
      }));
    }

    if (attempt && (!application.readinessAttempt || application.readinessAttempt.toString() !== attempt._id.toString())) {
      application.readinessAttempt = attempt._id;
      await application.save();
    }

    function formatInvoiceResponse(inv) {
      if (!inv) return null;
      const exp = inv.dueAt || inv.dueDate || inv.expiresAt || new Date(Date.now() + 72 * 3600 * 1000);
      const diffSec = Math.max(0, Math.floor((new Date(exp) - new Date()) / 1000));
      return {
        id: inv._id,
        invoiceNumber: inv.invoiceNumber,
        amount: inv.amount,
        currency: inv.currency || 'EGP',
        status: inv.status,
        dueDate: exp,
        dueAt: exp,
        expiresAt: exp,
        remainingSeconds: diffSec,
      };
    }

    const existingInvoice = await Invoice.findOne({ application: application._id, status: { $ne: 'Cancelled' } });

    res.json({
      success: true,
      data: {
        course: {
          id: course._id,
          title: course.title,
          code: course.code,
          level: course.level,
          division: course.division,
          price: course.price,
          currency: course.currency || 'EGP',
          description: course.description,
          syllabus: course.syllabus,
          prerequisites: course.prerequisites || [],
          mandatoryPrerequisites: course.mandatoryPrerequisites || [],
          readinessThreshold: course.readinessThreshold || 70,
        },
        application: {
          id: application._id,
          status: application.status,
          eligibilityStatus: application.eligibilityStatus,
          cohort: application.cohort,
        },
        eligibility: {
          isEligible: evaluation.isEligible,
          status: evaluation.status,
          divisionMatch: evaluation.divisionMatch,
          studentDivision: evaluation.studentDivision,
          courseDivision: evaluation.courseDivision,
          missingRequirements: evaluation.missingRequirements,
          reasons: evaluation.reasons,
          recommendedCourse: evaluation.recommendedCourse,
          actionableNextSteps: evaluation.actionableNextSteps,
          requiresReadiness: evaluation.requiresReadiness,
        },
        readiness: {
          attemptId: attempt?._id,
          questions: questionsForClient,
          questionCount: questionsForClient.length,
          timeLimitMinutes: 15,
        },
        invoice: formatInvoiceResponse(existingInvoice),
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/admissions/complete-assessment
 * Evaluates answers, derives outcome, updates Application.status,
 * and if passed, automatically issues the Invoice with provisional seat hold.
 */
async function completeAssessment(req, res, next) {
  try {
    const { courseId, attemptId, applicationId, answers } = req.body;
    if (!answers || !Array.isArray(answers)) {
      throw new AppError('Answers array is required.', 400);
    }

    let attempt = null;
    if (attemptId) {
      attempt = await ReadinessAttempt.findOne({ _id: attemptId, student: req.user._id }).populate('questions');
    }
    if (!attempt && applicationId) {
      const appDoc = await Application.findById(applicationId);
      if (appDoc?.readinessAttempt) {
        attempt = await ReadinessAttempt.findById(appDoc.readinessAttempt).populate('questions');
      }
    }
    if (!attempt && courseId) {
      attempt = await ReadinessAttempt.findOne({
        student: req.user._id,
        course: courseId,
        status: 'InProgress',
      }).sort({ createdAt: -1 }).populate('questions');
    }

    if (!attempt) {
      throw new AppError('Assessment attempt not found.', 404);
    }

    const course = await Course.findById(attempt.course).populate('recommendedPreviousCourses');
    if (!course) throw new AppError('Course not found.', 404);

    let application = applicationId ? await Application.findById(applicationId) : null;
    if (!application) {
      application = await Application.findOne({
        student: req.user._id,
        course: course._id,
        status: { $nin: ['Cancelled', 'Withdrawn', 'Rejected'] },
      }).sort({ createdAt: -1 });
    }

    attempt.answers = attempt.questions.map((q) => {
      const qIdStr = q._id.toString();
      const given = answers.find(
        (a) => a && (a.questionId === qIdStr || a.id === qIdStr || String(a.questionId) === qIdStr)
      );
      const chosenIndex = given && given.selectedOptionIndex !== undefined ? Number(given.selectedOptionIndex) : -1;
      const isCorrect = chosenIndex === q.correctOptionIndex;
      return {
        question: q._id,
        selectedOption: chosenIndex,
        isCorrect,
      };
    });

    const scoringResult = await scoreAttempt(attempt, course);

    attempt.score = scoringResult.score;
    attempt.scorePercentage = scoringResult.score;
    attempt.status = 'Submitted';
    attempt.submittedAt = new Date();
    attempt.outcome = scoringResult.outcome;
    attempt.topicBreakdown = scoringResult.topicBreakdown;
    attempt.knowledgeGaps = scoringResult.knowledgeGaps;
    await attempt.save();

    const threshold = course.readinessThreshold || 70;
    const passed = scoringResult.score >= threshold;

    let invoice = null;

    if (passed && application) {
      const reservation = await autoAcceptAndReserveSeat({
        application,
        studentId: req.user._id,
        courseId: course._id,
        cohortId: application.cohort,
      });

      application = reservation.application || application;
      invoice = reservation.invoice;
    } else if (application) {
      application.status = 'Foundation Required';
      application.eligibilityStatus = 'Foundation Required';
      application.missingRequirements = [
        `AI Readiness score (${scoringResult.score}%) is below the required threshold of ${threshold}%.`,
        ...scoringResult.knowledgeGaps.map((g) => `Deficiency in topic: ${g}`),
      ];
      await application.save();
    }

    if (!invoice && application) {
      invoice = await Invoice.findOne({ application: application._id, status: { $ne: 'Cancelled' } });
    }

    res.json({
      success: true,
      message: passed
        ? 'Assessment passed! Seat reserved and invoice issued.'
        : 'Assessment completed. Foundation course recommended.',
      data: {
        score: scoringResult.score,
        passed,
        threshold,
        outcome: scoringResult.outcome,
        knowledgeGaps: scoringResult.knowledgeGaps,
        topicBreakdown: scoringResult.topicBreakdown,
        recommendedCourse: scoringResult.recommendedCourse || null,
        recommendedCourses: scoringResult.recommendedCourses || [],
        application: application
          ? {
              id: application._id,
              status: application.status,
              eligibilityStatus: application.eligibilityStatus,
            }
          : null,
        invoice: invoice
          ? {
              id: invoice._id,
              invoiceNumber: invoice.invoiceNumber,
              amount: invoice.amount,
              currency: invoice.currency || 'EGP',
              status: invoice.status,
              dueDate: invoice.dueAt || invoice.dueDate || invoice.expiresAt || new Date(Date.now() + 72 * 3600 * 1000),
              dueAt: invoice.dueAt || invoice.dueDate || invoice.expiresAt || new Date(Date.now() + 72 * 3600 * 1000),
              expiresAt: invoice.dueAt || invoice.dueDate || invoice.expiresAt || new Date(Date.now() + 72 * 3600 * 1000),
              remainingSeconds: Math.max(
                0,
                Math.floor(
                  (new Date(invoice.dueAt || invoice.dueDate || invoice.expiresAt || Date.now() + 72 * 3600 * 1000) -
                    new Date()) /
                    1000
                )
              ),
            }
          : null,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  checkEligibility,
  apply,
  startFlow,
  completeAssessment,
  listApplicationsForDivisionAdmin,
  approveOverride,
  requestMoreInfo,
  rejectApplication,
  getAuditLogsForDivisionAdmin,
};
