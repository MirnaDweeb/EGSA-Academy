const ReadinessQuestion = require('../models/ReadinessQuestion');
const ReadinessAttempt = require('../models/ReadinessAttempt');
const Course = require('../models/Course');
const Application = require('../models/Application');
const Invoice = require('../models/Invoice');
const { scoreAttempt } = require('../services/readinessService');
const { autoAcceptAndReserveSeat } = require('../services/admissionService');
const { notify } = require('../services/notificationService');
const { recordAudit } = require('../services/auditService');
const { AppError } = require('../middleware/error');

/**
 * Resolve questions for a course:
 * 1. Course-specific questions if configured
 * 2. Shared default questions fallback
 */
async function getQuestionsForCourse(course) {
  // 1. Try to find course-specific custom questions
  let questions = [];
  try {
    questions = await ReadinessQuestion.aggregate([
      { $match: { course: course._id, isDefault: { $ne: true } } },
      { $sample: { size: 12 } },
    ]);
  } catch (_) {
    questions = await ReadinessQuestion.find({ course: course._id, isDefault: { $ne: true } }).limit(12);
  }

  if (questions.length === 0) {
    questions = await ReadinessQuestion.find({ course: course._id, isDefault: { $ne: true } }).limit(12);
  }

  // Auto-ensure CrossFit readiness bank if accessing CrossFit course
  if (questions.length === 0 && (course.slug === 'crossfit-functional-fitness-program' || /crossfit/i.test(course.title))) {
    try {
      const { ensureCrossfitCourse } = require('../services/crossfitInitService');
      await ensureCrossfitCourse();
      questions = await ReadinessQuestion.aggregate([
        { $match: { course: course._id, isDefault: { $ne: true } } },
        { $sample: { size: 12 } },
      ]);
    } catch (seedErr) {
      console.error('[CROSSFIT SEED ERROR]', seedErr);
    }
  }

  // 2. Fallback to shared/default readiness question bank
  if (questions.length === 0) {
    try {
      const { ensureDefaultReadinessQuestions } = require('../services/defaultReadinessInitService');
      await ensureDefaultReadinessQuestions();

      questions = await ReadinessQuestion.aggregate([
        { $match: { $or: [{ course: null }, { isDefault: true }] } },
        { $sample: { size: 12 } },
      ]);
    } catch (defaultErr) {
      console.error('[DEFAULT READINESS ERROR]', defaultErr);
    }
  }

  // 3. Fallback to any default questions if aggregate returned empty
  if (questions.length === 0) {
    questions = await ReadinessQuestion.find({ isDefault: true }).limit(12);
  }

  return questions;
}

/**
 * GET /api/readiness/course/:courseId
 * Returns randomized questions for the course (omitting correctOptionIndex for students).
 */
async function getCourseQuestions(req, res, next) {
  try {
    const { courseId } = req.params;
    const course = await Course.findById(courseId);
    if (!course) throw new AppError('Course not found.', 404);

    const questions = await getQuestionsForCourse(course);
    const sanitizedQuestions = questions.map((q) => ({
      id: q._id,
      questionId: q._id,
      questionText: q.questionText || q.question,
      question: q.questionText || q.question,
      options: q.options,
      topic: q.topic,
      difficulty: q.difficulty || 'Medium',
      weight: q.weight || 1,
    }));

    res.json({
      success: true,
      count: sanitizedQuestions.length,
      data: sanitizedQuestions,
      course: {
        id: course._id,
        title: course.title,
        slug: course.slug,
        level: course.level,
        division: course.division,
        readinessThreshold: course.readinessThreshold || 70,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/readiness/start
 * Starts or resumes a readiness attempt session for a student.
 */
async function startAssessment(req, res, next) {
  try {
    const courseId = req.body?.courseId || req.query?.courseId;
    if (!courseId) throw new AppError('Course ID is required.', 400);

    const course = await Course.findById(courseId);
    if (!course) throw new AppError('Course not found.', 404);

    const retake = req.body?.retake === true || req.query?.retake === 'true';

    // Prevent duplicate active attempts (resume if in-progress)
    if (!retake && typeof ReadinessAttempt.findOne === 'function') {
      try {
        const query = ReadinessAttempt.findOne({
          student: req.user?._id,
          course: course._id,
          status: 'InProgress',
        });
        const existingAttempt = query && typeof query.populate === 'function'
          ? await query.populate('questions')
          : (query && typeof query.then === 'function' ? await query : null);

        if (existingAttempt && Array.isArray(existingAttempt.questions) && existingAttempt.questions.length > 0) {
          const validQuestions = existingAttempt.questions.filter((q) => q && (q.question || q.questionText));
          if (validQuestions.length > 0) {
            const questionsForClient = validQuestions.map((q) => ({
              id: q._id,
              questionId: q._id,
              questionText: q.questionText || q.question,
              question: q.questionText || q.question,
              options: q.options,
              topic: q.topic,
              difficulty: q.difficulty || 'Medium',
              weight: q.weight || 1,
            }));

            return res.status(200).json({
              success: true,
              data: {
                attemptId: existingAttempt._id,
                questions: questionsForClient,
                resumed: true,
                answers: existingAttempt.answers || [],
                course: {
                  id: course._id,
                  title: course.title,
                  slug: course.slug,
                },
              },
            });
          }
        }
      } catch (_) {}
    }

    const questions = await getQuestionsForCourse(course);

    if (questions.length === 0) {
      throw new AppError('Unable to load readiness assessment questions at this time.', 500);
    }

    const attempt = await ReadinessAttempt.create({
      student: req.user._id,
      course: course._id,
      questions: questions.map((q) => q._id),
      status: 'InProgress',
    });

    const questionsForClient = questions.map((q) => ({
      id: q._id,
      questionId: q._id,
      questionText: q.questionText || q.question,
      question: q.questionText || q.question,
      options: q.options,
      topic: q.topic,
      difficulty: q.difficulty || 'Medium',
      weight: q.weight || 1,
    }));

    res.status(201).json({
      success: true,
      data: {
        attemptId: attempt._id,
        questions: questionsForClient,
        resumed: false,
        course: {
          id: course._id,
          title: course.title,
          slug: course.slug,
        },
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/readiness/:attemptId
 */
async function getAttempt(req, res, next) {
  try {
    const attempt = await ReadinessAttempt.findOne({
      _id: req.params.attemptId,
      student: req.user._id,
    })
      .populate('course', 'title slug level category price currency readinessThreshold')
      .populate('questions');

    if (!attempt) throw new AppError('Assessment attempt not found.', 404);

    const validQuestions = (attempt.questions || []).filter((q) => q && (q.question || q.questionText));
    const questionsForClient = validQuestions.map((q) => ({
      id: q._id,
      questionId: q._id,
      questionText: q.questionText || q.question,
      question: q.questionText || q.question,
      options: q.options,
      topic: q.topic,
      difficulty: q.difficulty || 'Medium',
      weight: q.weight || 1,
    }));

    res.json({
      success: true,
      data: {
        attemptId: attempt._id,
        course: attempt.course,
        status: attempt.status,
        score: attempt.score,
        scorePercentage: attempt.scorePercentage ?? attempt.score,
        outcome: attempt.outcome,
        topicBreakdown: attempt.topicBreakdown || [],
        knowledgeGaps: attempt.knowledgeGaps || [],
        questions: questionsForClient,
        answers: attempt.answers || [],
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/readiness/status/:courseId
 */
async function getAssessmentStatus(req, res, next) {
  try {
    const { courseId } = req.params;
    const course = await Course.findById(courseId);
    if (!course) throw new AppError('Course not found.', 404);

    const inProgressAttempt = await ReadinessAttempt.findOne({
      student: req.user._id,
      course: course._id,
      status: 'InProgress',
    }).sort({ createdAt: -1 });

    const latestSubmittedAttempt = await ReadinessAttempt.findOne({
      student: req.user._id,
      course: course._id,
      status: 'Submitted',
    }).sort({ submittedAt: -1 });

    const hasCustomQuestions = !!(await ReadinessQuestion.exists({
      course: course._id,
      isDefault: { $ne: true },
    }));

    res.json({
      success: true,
      data: {
        course: {
          id: course._id,
          title: course.title,
          slug: course.slug,
        },
        hasCustomQuestions,
        hasAssessment: true,
        inProgressAttemptId: inProgressAttempt ? inProgressAttempt._id : null,
        latestSubmittedAttemptId: latestSubmittedAttempt ? latestSubmittedAttempt._id : null,
        latestOutcome: latestSubmittedAttempt ? latestSubmittedAttempt.outcome : null,
        latestScore: latestSubmittedAttempt ? (latestSubmittedAttempt.scorePercentage ?? latestSubmittedAttempt.score) : null,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/readiness/submit and POST /api/readiness/:attemptId/submit
 * Receives student answers ({ applicationId, answers: [{ questionId, selectedIndex }] }).
 * Evaluates composite percentage and topic-level gap analysis.
 */
async function submitAssessment(req, res, next) {
  try {
    const { answers, applicationId, attemptId: bodyAttemptId } = req.body;
    const targetAttemptId = req.params.attemptId || bodyAttemptId;

    if (!answers || !Array.isArray(answers) || answers.length === 0) {
      throw new AppError('Assessment submission must contain an array of answers.', 400);
    }

    let attempt = null;
    let linkedApp = null;

    if (applicationId) {
      linkedApp = await Application.findById(applicationId);
    }

    if (targetAttemptId) {
      attempt = await ReadinessAttempt.findOne({
        _id: targetAttemptId,
        student: req.user._id,
      }).populate('questions');
    }

    if (!attempt && linkedApp) {
      if (linkedApp.readinessAttempt) {
        attempt = await ReadinessAttempt.findById(linkedApp.readinessAttempt).populate('questions');
      }
      if (!attempt) {
        attempt = await ReadinessAttempt.findOne({
          student: req.user._id,
          course: linkedApp.course,
          status: 'InProgress',
        }).populate('questions');
      }
      if (!attempt) {
        const course = await Course.findById(linkedApp.course);
        const questions = await getQuestionsForCourse(course);
        attempt = await ReadinessAttempt.create({
          student: req.user._id,
          course: course._id,
          application: linkedApp._id,
          questions: questions.map((q) => q._id),
          status: 'InProgress',
        });
        attempt = await ReadinessAttempt.findById(attempt._id).populate('questions');
      }
    }

    if (!attempt) {
      throw new AppError('Assessment attempt not found. Please provide a valid attemptId or applicationId.', 404);
    }

    const course = await Course.findById(attempt.course);
    if (!course) throw new AppError('Course not found.', 404);

    // If application was not loaded yet, check attempt.application or search active app
    if (!linkedApp) {
      if (attempt.application) {
        linkedApp = await Application.findById(attempt.application);
      } else {
        linkedApp = await Application.findOne({
          student: req.user._id,
          course: course._id,
          status: { $nin: ['Cancelled', 'Withdrawn', 'Rejected', 'Confirmed', 'Completed'] },
        }).sort({ createdAt: -1 });
      }
    }

    attempt.answers = attempt.questions.map((q) => {
      const given = answers.find(
        (a) => a && (a.questionId === q._id.toString() || a.questionId === q._id || a.id === q._id.toString())
      );
      const selectedIndex =
        given && typeof given.selectedIndex === 'number'
          ? given.selectedIndex
          : given && typeof given.selectedAnswerIndex === 'number'
          ? given.selectedAnswerIndex
          : -1;
      const correctIdx = q.correctOptionIndex !== undefined ? q.correctOptionIndex : q.correctAnswerIndex;
      return {
        question: q._id,
        selectedIndex,
        isCorrect: selectedIndex === correctIdx,
      };
    });

    const {
      score,
      scorePercentage,
      topicBreakdown,
      knowledgeGaps,
      outcome,
      recommendedCourse,
      recommendedCourses,
      rationale,
    } = await scoreAttempt(attempt, course);

    const threshold = course.readinessThreshold || course.minReadinessScore || 70;

    attempt.score = score;
    attempt.scorePercentage = scorePercentage;
    attempt.topicBreakdown = topicBreakdown;
    attempt.knowledgeGaps = knowledgeGaps;
    attempt.outcome = outcome;
    attempt.recommendedCourse = recommendedCourse ? recommendedCourse._id : undefined;
    attempt.recommendedCourses = (recommendedCourses || []).map((c) => c._id);
    attempt.rationale = rationale;
    attempt.status = 'Submitted';
    attempt.submittedAt = new Date();
    if (linkedApp) {
      attempt.application = linkedApp._id;
    }
    await attempt.save();

    // Link and update active Application
    let admissionResult = null;
    if (linkedApp) {
      linkedApp.readinessAttempt = attempt._id;

      if (scorePercentage >= threshold) {
        linkedApp.status = 'Eligible - Payment Pending';
        linkedApp.eligibilityStatus = 'Eligible';
        linkedApp.statusHistory = linkedApp.statusHistory || [];
        linkedApp.statusHistory.push({
          status: 'Eligible - Payment Pending',
          note: `Readiness evaluation passed (${scorePercentage}% >= ${threshold}%). Outcome: ${outcome}.`,
          changedAt: new Date(),
        });
        await linkedApp.save();

        // Automatically accept and reserve seat if possible
        try {
          admissionResult = await autoAcceptAndReserveSeat({
            application: linkedApp,
            studentId: req.user._id,
            courseId: course._id,
          });
          if (admissionResult?.application) {
            linkedApp = admissionResult.application;
          }
        } catch (_) {}
      } else {
        linkedApp.status = 'Foundation Required';
        linkedApp.eligibilityStatus = 'Foundation Required';
        linkedApp.statusHistory = linkedApp.statusHistory || [];
        linkedApp.statusHistory.push({
          status: 'Foundation Required',
          note: `Readiness score (${scorePercentage}% < ${threshold}%). Knowledge gaps: ${knowledgeGaps.join(', ')}.`,
          changedAt: new Date(),
        });
        await linkedApp.save();
      }
    }

    await notify({
      recipient: req.user._id,
      title: 'Readiness Assessment Evaluated',
      message: `You scored ${scorePercentage}% on ${course.title}. Readiness Outcome: ${outcome}.`,
      type: scorePercentage >= threshold ? 'success' : 'warning',
      relatedCourse: course._id,
    });

    res.json({
      success: true,
      data: {
        attemptId: attempt._id,
        score: scorePercentage,
        scorePercentage,
        threshold,
        outcome,
        topicBreakdown,
        knowledgeGaps,
        recommendedCourse,
        recommendedCourses,
        rationale,
        linkedApplicationId: linkedApp ? linkedApp._id : null,
        applicationStatus: linkedApp ? linkedApp.status : null,
        application: linkedApp || null,
        invoiceId: admissionResult?.invoice ? admissionResult.invoice._id : null,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/readiness/:attemptId/result
 */
async function getResult(req, res, next) {
  try {
    const attempt = await ReadinessAttempt.findOne({
      _id: req.params.attemptId,
      student: req.user._id,
    })
      .populate('course', 'title slug level price currency duration deliveryMode readinessThreshold')
      .populate('recommendedCourse', 'title slug level')
      .populate('recommendedCourses', 'title slug level');

    if (!attempt) throw new AppError('Assessment attempt not found.', 404);
    if (attempt.status !== 'Submitted') throw new AppError('Assessment not yet submitted.', 400);

    let linkedApp = null;
    let invoice = null;

    if (attempt.application) {
      linkedApp = await Application.findById(attempt.application);
    } else if (attempt.course?._id) {
      linkedApp = await Application.findOne({
        student: req.user._id,
        course: attempt.course._id,
        status: { $nin: ['Cancelled', 'Withdrawn', 'Rejected'] },
      }).sort({ createdAt: -1 });
    }

    if (linkedApp) {
      invoice = await Invoice.findOne({ application: linkedApp._id, student: req.user._id });
    }

    res.json({
      success: true,
      data: {
        ...attempt.toObject(),
        scorePercentage: attempt.scorePercentage ?? attempt.score,
        application: linkedApp || null,
        invoice: invoice || null,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/readiness/admin/attempts
 * Scoped to Division Admin, listing cohort readiness attempts, score distribution, and flagged knowledge gaps.
 */
async function listAdminAttempts(req, res, next) {
  try {
    const filter = {};

    // Apply division scope if present
    if (req.scopeDivision && req.scopeDivision !== 'all') {
      const divisionCourses = await Course.find({ division: req.scopeDivision }).select('_id');
      const courseIds = divisionCourses.map((c) => c._id);
      filter.course = { $in: courseIds };
    }

    if (req.query.courseId) {
      filter.course = req.query.courseId;
    }
    if (req.query.outcome) {
      filter.outcome = req.query.outcome;
    }

    const attempts = await ReadinessAttempt.find(filter)
      .populate('student', 'fullName name email phone')
      .populate('course', 'title code division level readinessThreshold')
      .populate('application', 'referenceNumber status eligibilityStatus')
      .populate('recommendedCourses', 'title code level')
      .populate('recommendedCourse', 'title code level')
      .populate('adminOverride.adminId', 'fullName name email')
      .sort({ submittedAt: -1, createdAt: -1 });

    let passedCount = 0;
    let failedCount = 0;
    let overrideCount = 0;
    const flaggedGaps = {};
    const scoreDistribution = { '<50': 0, '50-69': 0, '70-84': 0, '85-100': 0 };

    attempts.forEach((att) => {
      const sc = att.scorePercentage ?? att.score ?? 0;
      if (sc < 50) scoreDistribution['<50']++;
      else if (sc < 70) scoreDistribution['50-69']++;
      else if (sc < 85) scoreDistribution['70-84']++;
      else scoreDistribution['85-100']++;

      if (['Ready', 'READY', 'ELIGIBLE'].includes(att.outcome)) {
        passedCount++;
      } else {
        failedCount++;
      }

      if (att.adminOverride?.applied) {
        overrideCount++;
      }

      if (Array.isArray(att.knowledgeGaps)) {
        att.knowledgeGaps.forEach((g) => {
          flaggedGaps[g] = (flaggedGaps[g] || 0) + 1;
        });
      }
    });

    res.json({
      success: true,
      count: attempts.length,
      data: attempts,
      summary: {
        totalAttempts: attempts.length,
        passedCount,
        failedCount,
        overrideCount,
        scoreDistribution,
        flaggedGaps,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * POST /api/readiness/admin/override/:attemptId
 * Allows Division Admin to override an attempt with reason, upgrading application to 'Eligible - Payment Pending'.
 */
async function adminOverrideAttempt(req, res, next) {
  try {
    const { attemptId } = req.params;
    const { reason } = req.body;

    if (!reason || !String(reason).trim()) {
      throw new AppError('A valid justification reason is required for manual override.', 400);
    }

    const attempt = await ReadinessAttempt.findById(attemptId).populate('course');
    if (!attempt) throw new AppError('Readiness attempt not found.', 404);

    attempt.adminOverride = {
      applied: true,
      reason: String(reason).trim(),
      adminId: req.user._id,
      overriddenAt: new Date(),
    };
    attempt.outcome = 'Ready';
    await attempt.save();

    let linkedApp = null;
    if (attempt.application) {
      linkedApp = await Application.findById(attempt.application);
    }
    if (!linkedApp) {
      linkedApp = await Application.findOne({
        student: attempt.student,
        course: attempt.course?._id || attempt.course,
      }).sort({ createdAt: -1 });
    }

    if (linkedApp) {
      linkedApp.status = 'Eligible - Payment Pending';
      linkedApp.eligibilityStatus = 'Eligible';
      linkedApp.adminOverride = {
        applied: true,
        reason: String(reason).trim(),
        adminId: req.user._id,
        overriddenAt: new Date(),
      };
      linkedApp.statusHistory = linkedApp.statusHistory || [];
      linkedApp.statusHistory.push({
        status: 'Eligible - Payment Pending',
        note: `Admin manual override applied: ${String(reason).trim()}`,
        changedAt: new Date(),
      });
      await linkedApp.save();
    }

    await recordAudit({
      user: req.user,
      action: 'READINESS_ADMIN_OVERRIDE',
      resource: 'ReadinessAttempt',
      resourceId: attempt._id,
      division: attempt.course?.division || null,
      reason: String(reason).trim(),
      after: {
        attemptId: attempt._id,
        outcome: 'Ready',
        applicationId: linkedApp?._id,
        applicationStatus: linkedApp?.status,
      },
    });

    res.json({
      success: true,
      message: 'Readiness attempt successfully overridden and application upgraded to Eligible - Payment Pending.',
      data: {
        attempt,
        application: linkedApp,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * ADMIN: Create a single readiness question for a course
 */
async function adminCreateQuestion(req, res, next) {
  try {
    const { courseId, question, questionText, options, correctOptionIndex, correctAnswerIndex, topic, difficulty = 'Medium', weight = 1 } = req.body;
    if (!courseId) throw new AppError('Course ID is required.', 400);
    const qText = questionText || question;
    if (!qText || !String(qText).trim()) throw new AppError('Question text is required.', 400);
    if (!Array.isArray(options) || options.length < 2) {
      throw new AppError('At least two options are required.', 400);
    }
    const cIdx = correctOptionIndex !== undefined ? correctOptionIndex : correctAnswerIndex;
    if (typeof cIdx !== 'number' || cIdx < 0 || cIdx >= options.length) {
      throw new AppError('Valid correctOptionIndex within options range is required.', 400);
    }
    if (!topic || !String(topic).trim()) throw new AppError('Topic is required.', 400);

    const course = await Course.findById(courseId);
    if (!course) throw new AppError('Course not found.', 404);

    const created = await ReadinessQuestion.create({
      course: course._id,
      questionText: qText.trim(),
      question: qText.trim(),
      options: options.map((opt) => String(opt).trim()),
      correctOptionIndex: cIdx,
      correctAnswerIndex: cIdx,
      topic: topic.trim(),
      difficulty,
      weight: Number(weight) || 1,
    });

    res.status(201).json({ success: true, data: created });
  } catch (err) {
    next(err);
  }
}

/**
 * ADMIN: Bulk create readiness questions for a course
 */
async function adminBulkCreateQuestions(req, res, next) {
  try {
    const { courseId, questions } = req.body;
    if (!courseId) throw new AppError('Course ID is required.', 400);
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new AppError('An array of questions is required.', 400);
    }

    const course = await Course.findById(courseId);
    if (!course) throw new AppError('Course not found.', 404);

    const docs = questions.map((q) => {
      const qText = q.questionText || q.question;
      const cIdx = q.correctOptionIndex !== undefined ? q.correctOptionIndex : q.correctAnswerIndex;
      if (!qText || !Array.isArray(q.options) || typeof cIdx !== 'number' || !q.topic) {
        throw new AppError('Each question must have question, options, correctOptionIndex, and topic.', 400);
      }
      return {
        course: course._id,
        questionText: qText.trim(),
        question: qText.trim(),
        options: q.options.map((opt) => String(opt).trim()),
        correctOptionIndex: cIdx,
        correctAnswerIndex: cIdx,
        topic: q.topic.trim(),
        difficulty: q.difficulty || 'Medium',
        weight: Number(q.weight) || 1,
      };
    });

    const inserted = await ReadinessQuestion.insertMany(docs);
    res.status(201).json({ success: true, count: inserted.length, data: inserted });
  } catch (err) {
    next(err);
  }
}

/**
 * ADMIN: List readiness questions (filtered by courseId)
 */
async function adminListQuestions(req, res, next) {
  try {
    const filter = {};
    if (req.query.courseId) {
      filter.course = req.query.courseId;
    }
    const questions = await ReadinessQuestion.find(filter)
      .populate('course', 'title code slug level division')
      .sort({ createdAt: -1 });

    res.json({ success: true, data: questions });
  } catch (err) {
    next(err);
  }
}

/**
 * ADMIN: Delete a readiness question
 */
async function adminDeleteQuestion(req, res, next) {
  try {
    const { questionId } = req.params;
    const deleted = await ReadinessQuestion.findByIdAndDelete(questionId);
    if (!deleted) throw new AppError('Question not found.', 404);

    res.json({ success: true, message: 'Readiness question deleted successfully.' });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getQuestionsForCourse,
  getCourseQuestions,
  startAssessment,
  getAttempt,
  getAssessmentStatus,
  submitAssessment,
  getResult,
  listAdminAttempts,
  adminOverrideAttempt,
  adminCreateQuestion,
  adminBulkCreateQuestions,
  adminListQuestions,
  adminDeleteQuestion,
};
