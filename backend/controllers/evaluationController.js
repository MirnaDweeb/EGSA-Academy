const Evaluation = require('../models/Evaluation');
const Enrollment = require('../models/Enrollment');
const Course = require('../models/Course');
const Cohort = require('../models/Cohort');
const Certificate = require('../models/Certificate');
const Notification = require('../models/Notification');
const { AppError } = require('../middleware/error');

/**
 * Check if the student has already submitted an evaluation for a cohort or course.
 * GET /api/evaluations/check/:cohortId
 */
async function checkEvaluationStatus(req, res, next) {
  try {
    const { cohortId } = req.params;
    const studentId = req.user._id;

    // Check enrollment
    const enrollment = await Enrollment.findOne({
      student: studentId,
      $or: [
        { cohort: cohortId },
        { course: cohortId },
        { _id: cohortId },
      ],
    }).populate('course cohort');

    // Check evaluation document
    const orConditions = [{ cohort: cohortId }, { course: cohortId }];
    if (enrollment) {
      orConditions.push({ enrollment: enrollment._id });
      if (enrollment.cohort) orConditions.push({ cohort: enrollment.cohort._id || enrollment.cohort });
      if (enrollment.course) orConditions.push({ course: enrollment.course._id || enrollment.course });
    }

    const evaluation = await Evaluation.findOne({
      student: studentId,
      $or: orConditions,
    });

    const isCompleted = Boolean(
      enrollment?.evaluationCompleted ||
      evaluation?.courseFeedbackCompleted ||
      evaluation?.overallRating ||
      evaluation?.ratings?.content
    );

    res.json({
      success: true,
      evaluationCompleted: isCompleted,
      data: {
        evaluationCompleted: isCompleted,
        evaluation: evaluation || null,
        enrollment: enrollment || null,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Submit course & instructor evaluation survey.
 * POST /api/evaluations
 * POST /api/evaluations/course
 */
async function submitEvaluation(req, res, next) {
  try {
    // If request indicates agency feedback, route to agency handler
    if (req.body.type === 'agency' || req.body.agencyRatings) {
      return submitAgencyEvaluation(req, res, next);
    }

    const {
      courseId,
      cohortId,
      ratings,
      comments = '',
      isAnonymous = true,
      contentRating,
      instructorRating,
      facilitiesRating,
      organizationRating,
    } = req.body;

    const targetCourseOrCohort = courseId || cohortId;
    if (!targetCourseOrCohort) {
      throw new AppError('courseId or cohortId is required.', 400);
    }

    // Extract the 4 ratings
    const content = Number(ratings?.content ?? contentRating);
    const instructorScore = Number(ratings?.instructor ?? instructorRating);
    const facilities = Number(ratings?.facilities ?? ratings?.labs ?? facilitiesRating);
    const organization = Number(ratings?.organization ?? organizationRating);

    const ratingValues = [
      { name: 'content', val: content },
      { name: 'instructor', val: instructorScore },
      { name: 'facilities', val: facilities },
      { name: 'organization', val: organization },
    ];

    for (const r of ratingValues) {
      if (isNaN(r.val) || r.val < 1 || r.val > 5) {
        throw new AppError(`Rating criteria "${r.name}" must be a number between 1 and 5.`, 400);
      }
    }

    // Compute overall rating
    const overallRating = Number(((content + instructorScore + facilities + organization) / 4).toFixed(2));

    // Verify enrollment
    const enrollmentFilter = {
      student: req.user._id,
      status: { $in: ['Confirmed', 'Active', 'Completed', 'CONFIRMED'] },
    };

    if (cohortId) {
      enrollmentFilter.$or = [{ cohort: cohortId }, { course: cohortId }];
    } else if (courseId) {
      enrollmentFilter.$or = [{ course: courseId }, { cohort: courseId }];
    }

    let enrollment = await Enrollment.findOne(enrollmentFilter).populate('course cohort');

    if (!enrollment) {
      throw new AppError('You must have an active or completed enrollment in this course to submit an evaluation.', 403);
    }

    const resolvedCourseId = enrollment.course?._id || enrollment.course;
    const resolvedCohortId = enrollment.cohort?._id || enrollment.cohort;
    const resolvedInstructorId = enrollment.cohort?.instructor || enrollment.course?.instructor;

    // Check duplicate evaluation submission
    const existing = await Evaluation.findOne({
      student: req.user._id,
      $or: [
        { course: resolvedCourseId },
        ...(resolvedCohortId ? [{ cohort: resolvedCohortId }] : []),
        { enrollment: enrollment._id },
      ],
    });

    if (existing && (existing.courseFeedbackCompleted || existing.ratings?.content || existing.overallRating || enrollment.evaluationCompleted)) {
      throw new AppError('Evaluation has already been submitted for this course/cohort.', 409);
    }

    // Save evaluation record
    const isAgencyDone = Boolean(existing?.agencyFeedbackCompleted);
    const commentsFormatted = typeof comments === 'string' ? comments.trim() : comments;

    let evaluation;
    if (existing) {
      existing.ratings = {
        content,
        instructor: instructorScore,
        facilities,
        labs: facilities,
        organization,
      };
      existing.overallRating = overallRating;
      existing.comments = commentsFormatted;
      existing.isAnonymous = isAnonymous !== false;
      existing.instructor = resolvedInstructorId;
      existing.cohort = resolvedCohortId;
      existing.enrollment = enrollment._id;
      existing.courseFeedbackCompleted = true;
      existing.courseFeedbackSubmittedAt = new Date();
      existing.submittedAt = new Date();
      evaluation = await existing.save();
    } else {
      evaluation = await Evaluation.create({
        student: req.user._id,
        course: resolvedCourseId,
        cohort: resolvedCohortId,
        enrollment: enrollment._id,
        instructor: resolvedInstructorId,
        ratings: {
          content,
          instructor: instructorScore,
          facilities,
          labs: facilities,
          organization,
        },
        overallRating,
        comments: commentsFormatted,
        isAnonymous: isAnonymous !== false,
        courseFeedbackCompleted: true,
        courseFeedbackSubmittedAt: new Date(),
        submittedAt: new Date(),
      });
    }

    // Update Enrollment Gate Synchronization
    enrollment.evaluationCompleted = true;
    enrollment.evaluationSubmittedAt = new Date();
    await enrollment.save();

    // Sync Certificate feedback flags
    await Certificate.findOneAndUpdate(
      { student: req.user._id, course: resolvedCourseId },
      {
        $set: {
          courseFeedbackCompleted: true,
          feedbackCompleted: true,
        },
      }
    );

    // In-app notification
    try {
      await Notification.create({
        recipient: req.user._id,
        title: 'Course Evaluation Submitted',
        message: 'Quality evaluation submitted successfully. Official Certificate gate is now unlocked!',
        type: 'success',
        relatedCourse: resolvedCourseId,
      });
    } catch (_) {}

    res.status(201).json({
      success: true,
      message: 'Quality Evaluation Submitted Successfully — Certificate Gate Unlocked!',
      data: evaluation,
      evaluationCompleted: true,
      courseFeedbackCompleted: true,
      agencyFeedbackCompleted: isAgencyDone,
      feedbackCompleted: true,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Submit Egyptian Space Agency / Agency Feedback survey.
 * POST /api/evaluations/agency
 */
async function submitAgencyEvaluation(req, res, next) {
  try {
    const { courseId, ratings, agencyRatings, comments, feedbackComments, recommendAgency } = req.body;
    const r = agencyRatings || ratings;
    if (!courseId) {
      throw new AppError('courseId is required.', 400);
    }

    if (!r || typeof r !== 'object') {
      throw new AppError('Agency survey ratings are required.', 400);
    }

    const {
      trainingEnvironment = 5,
      facilitiesAndLabs = 5,
      organizationAndStaff = 5,
      platformExperience = 5,
      overallSatisfaction = 5,
    } = r;

    const values = [trainingEnvironment, facilitiesAndLabs, organizationAndStaff, platformExperience, overallSatisfaction];
    for (const val of values) {
      const num = Number(val);
      if (isNaN(num) || num < 1 || num > 5) {
        throw new AppError('All agency survey criteria must be numbers between 1 and 5.', 400);
      }
    }

    // Verify enrollment
    const enrollment = await Enrollment.findOne({
      student: req.user._id,
      course: courseId,
      status: { $in: ['Confirmed', 'Active', 'Completed'] },
    });

    if (!enrollment) {
      throw new AppError('You must have an active or completed enrollment in this course to submit agency feedback.', 403);
    }

    const existing = await Evaluation.findOne({ student: req.user._id, course: courseId });
    const isCourseDone = Boolean(existing?.courseFeedbackCompleted || existing?.ratings?.content);

    const evaluation = await Evaluation.findOneAndUpdate(
      { student: req.user._id, course: courseId },
      {
        $set: {
          student: req.user._id,
          course: courseId,
          cohort: enrollment.cohort,
          enrollment: enrollment._id,
          agencyFeedback: {
            trainingEnvironment: Number(trainingEnvironment),
            facilitiesAndLabs: Number(facilitiesAndLabs),
            organizationAndStaff: Number(organizationAndStaff),
            platformExperience: Number(platformExperience),
            overallSatisfaction: Number(overallSatisfaction),
            recommendAgency: recommendAgency !== false,
            comments: String(feedbackComments || comments || '').trim(),
            submittedAt: new Date(),
          },
          agencyFeedbackCompleted: true,
          submittedAt: new Date(),
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    const isAllFeedbackDone = isCourseDone;

    // Sync Certificate feedback completion flags
    const cert = await Certificate.findOneAndUpdate(
      { student: req.user._id, course: courseId },
      {
        $set: {
          agencyFeedbackCompleted: true,
          ...(isAllFeedbackDone ? { feedbackCompleted: true } : {}),
        },
      },
      { new: true }
    );
    if (cert) {

      // If all feedback done and admin already created/issued certificate, notify student ready
      if (isAllFeedbackDone && cert.adminCreated && (cert.status === 'ISSUED' || cert.fileUrl)) {
        try {
          await Notification.create({
            recipient: req.user._id,
            title: 'Certificate Ready',
            message: 'Your certificate is now available.',
            type: 'success',
            relatedCourse: courseId,
          });
        } catch (notifErr) {
          console.error('[NOTIF ERROR]', notifErr.message);
        }
      }
    }

    // In-App Notification for Agency Feedback
    try {
      await Notification.create({
        recipient: req.user._id,
        title: 'Egyptian Space Agency Feedback Submitted',
        message: 'Agency feedback submitted successfully. Thank you for helping us improve Egyptian Space Agency training programs.',
        type: 'success',
        relatedCourse: courseId,
      });
    } catch (notifErr) {
      console.error('[EVALUATION] Failed to dispatch notification:', notifErr.message);
    }

    res.status(201).json({
      success: true,
      message: isAllFeedbackDone
        ? 'Egyptian Space Agency feedback submitted successfully. All required feedback forms are now complete!'
        : 'Egyptian Space Agency feedback submitted successfully. Please complete Course feedback to finish your requirements.',
      data: evaluation,
      courseFeedbackCompleted: isCourseDone,
      agencyFeedbackCompleted: true,
      feedbackCompleted: isAllFeedbackDone,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get detailed feedback status for a specific course.
 * GET /api/evaluations/status/:courseId
 */
async function getEvaluationStatusForCourse(req, res, next) {
  try {
    const evaluation = await Evaluation.findOne({
      student: req.user._id,
      course: req.params.courseId,
    });

    const courseDone = Boolean(evaluation?.courseFeedbackCompleted || evaluation?.ratings?.content);
    const agencyDone = Boolean(evaluation?.agencyFeedbackCompleted);

    res.json({
      success: true,
      data: {
        courseId: req.params.courseId,
        courseFeedbackCompleted: courseDone,
        agencyFeedbackCompleted: agencyDone,
        feedbackCompleted: courseDone && agencyDone,
        evaluation,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get all evaluations submitted by current student.
 * GET /api/evaluations/my
 */
async function getMyEvaluations(req, res, next) {
  try {
    const evaluations = await Evaluation.find({ student: req.user._id })
      .populate('course', 'title category level')
      .populate('cohort', 'name startDate endDate')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: evaluations,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Get evaluation for a specific course by current student.
 * GET /api/evaluations/course/:courseId
 */
async function getEvaluationForCourse(req, res, next) {
  try {
    const evaluation = await Evaluation.findOne({
      student: req.user._id,
      course: req.params.courseId,
    }).populate('course', 'title category level');

    res.json({
      success: true,
      data: evaluation || null,
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Admin: List and aggregate evaluations across all courses.
 * GET /api/evaluations/admin
 */
async function adminListEvaluations(req, res, next) {
  try {
    const { courseId, cohortId } = req.query;
    const filter = {};
    if (courseId) filter.course = courseId;
    if (cohortId) filter.cohort = cohortId;

    const evaluations = await Evaluation.find(filter)
      .populate('student', 'fullName email')
      .populate('course', 'title code level')
      .populate('cohort', 'name')
      .sort({ createdAt: -1 });

    // Compute aggregated averages
    let avgContent = 0;
    let avgInstructor = 0;
    let avgLabs = 0;
    let avgOrg = 0;
    const count = evaluations.length;

    if (count > 0) {
      avgContent = (evaluations.reduce((acc, e) => acc + (e.ratings?.content || 0), 0) / count).toFixed(2);
      avgInstructor = (evaluations.reduce((acc, e) => acc + (e.ratings?.instructor || 0), 0) / count).toFixed(2);
      avgLabs = (evaluations.reduce((acc, e) => acc + (e.ratings?.labs || 0), 0) / count).toFixed(2);
      avgOrg = (evaluations.reduce((acc, e) => acc + (e.ratings?.organization || 0), 0) / count).toFixed(2);
    }

    res.json({
      success: true,
      data: {
        totalEvaluations: count,
        averages: {
          content: Number(avgContent),
          instructor: Number(avgInstructor),
          labs: Number(avgLabs),
          organization: Number(avgOrg),
          overall: count > 0 ? Number(((Number(avgContent) + Number(avgInstructor) + Number(avgLabs) + Number(avgOrg)) / 4).toFixed(2)) : 0,
        },
        evaluations,
      },
    });
  } catch (err) {
    next(err);
  }
}

const evaluationService = require('../services/evaluationService');

async function evaluateCohortAdmin(req, res, next) {
  try {
    const result = await evaluationService.evaluateCohort({
      cohortId: req.params.id,
      user: req.user,
    });
    res.status(201).json({ success: true, message: 'Cohort evaluations processed', data: result });
  } catch (err) {
    next(err);
  }
}

async function getCohortEvaluationsAdmin(req, res, next) {
  try {
    const evaluations = await evaluationService.getCohortEvaluations({
      cohortId: req.params.id,
      user: req.user,
    });
    res.json({ success: true, data: { evaluations } });
  } catch (err) {
    next(err);
  }
}

/**
 * Instructor Evaluation Summary (Aggregated & Anonymous)
 * GET /api/evaluations/instructor/summary
 */
async function getInstructorSummary(req, res, next) {
  try {
    const instructorId = req.user._id;

    // Find cohorts and courses where current user is assigned as instructor
    const [cohorts, courses] = await Promise.all([
      Cohort.find({ instructor: instructorId }).select('_id name course'),
      Course.find({ instructor: instructorId }).select('_id title code'),
    ]);

    const cohortIds = cohorts.map((c) => c._id);
    const courseIds = courses.map((c) => c._id);

    const filter = {
      $or: [
        { instructor: instructorId },
        ...(cohortIds.length ? [{ cohort: { $in: cohortIds } }] : []),
        ...(courseIds.length ? [{ course: { $in: courseIds } }] : []),
      ],
    };

    const evaluations = await Evaluation.find(filter)
      .populate('course', 'title code level')
      .populate('cohort', 'name')
      .populate('student', 'fullName email')
      .sort({ createdAt: -1 });

    const count = evaluations.length;
    let avgContent = 0;
    let avgInstructor = 0;
    let avgFacilities = 0;
    let avgOrganization = 0;
    let overallAvg = 0;

    if (count > 0) {
      avgContent = Number((evaluations.reduce((acc, e) => acc + (e.ratings?.content || 0), 0) / count).toFixed(2));
      avgInstructor = Number((evaluations.reduce((acc, e) => acc + (e.ratings?.instructor || 0), 0) / count).toFixed(2));
      avgFacilities = Number((evaluations.reduce((acc, e) => acc + (e.ratings?.facilities || e.ratings?.labs || 0), 0) / count).toFixed(2));
      avgOrganization = Number((evaluations.reduce((acc, e) => acc + (e.ratings?.organization || 0), 0) / count).toFixed(2));
      overallAvg = Number((evaluations.reduce((acc, e) => acc + (e.overallRating || 0), 0) / count).toFixed(2));
    }

    // Anonymous comments list - strictly preserving student privacy
    const anonymousComments = evaluations
      .filter((e) => {
        if (!e.comments) return false;
        if (typeof e.comments === 'string') return e.comments.trim().length > 0;
        return Boolean(e.comments.highlights || e.comments.improvements);
      })
      .map((e) => {
        let text = '';
        if (typeof e.comments === 'string') {
          text = e.comments;
        } else {
          text = [e.comments.highlights, e.comments.improvements].filter(Boolean).join(' | ');
        }

        const isAnon = e.isAnonymous !== false;
        return {
          id: e._id,
          comment: text,
          comments: text,
          rating: e.overallRating,
          overallRating: e.overallRating,
          submittedAt: e.submittedAt || e.createdAt,
          isAnonymous: isAnon,
          // Guarantee no identity disclosure if isAnonymous is true
          studentName: isAnon ? 'Anonymous Student' : (e.student?.fullName || 'Verified Student'),
          cohortName: e.cohort?.name || 'General Cohort',
          courseTitle: e.course?.title || 'Course',
        };
      });

    res.json({
      success: true,
      data: {
        totalEvaluations: count,
        count,
        averages: {
          contentRating: avgContent,
          instructorRating: avgInstructor,
          facilitiesRating: avgFacilities,
          organizationRating: avgOrganization,
          overallRating: overallAvg,
          content: avgContent,
          instructor: avgInstructor,
          facilities: avgFacilities,
          organization: avgOrganization,
          overall: overallAvg,
        },
        ratings: {
          content: avgContent,
          instructor: avgInstructor,
          facilities: avgFacilities,
          organization: avgOrganization,
          overall: overallAvg,
        },
        comments: anonymousComments,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * Division Admin Evaluation Summary (Cohort-level KPIs)
 * GET /api/evaluations/admin/summary
 */
async function getAdminSummary(req, res, next) {
  try {
    const { cohortId, courseId } = req.query;
    const filter = {};
    if (cohortId) filter.cohort = cohortId;
    if (courseId) filter.course = courseId;

    const evaluations = await Evaluation.find(filter)
      .populate('student', 'fullName email')
      .populate('course', 'title code level division')
      .populate('cohort', 'name')
      .populate('instructor', 'fullName email')
      .sort({ createdAt: -1 });

    const count = evaluations.length;
    let avgContent = 0;
    let avgInstructor = 0;
    let avgFacilities = 0;
    let avgOrganization = 0;
    let overallAvg = 0;
    let satisfiedCount = 0;

    if (count > 0) {
      avgContent = Number((evaluations.reduce((acc, e) => acc + (e.ratings?.content || 0), 0) / count).toFixed(2));
      avgInstructor = Number((evaluations.reduce((acc, e) => acc + (e.ratings?.instructor || 0), 0) / count).toFixed(2));
      avgFacilities = Number((evaluations.reduce((acc, e) => acc + (e.ratings?.facilities || e.ratings?.labs || 0), 0) / count).toFixed(2));
      avgOrganization = Number((evaluations.reduce((acc, e) => acc + (e.ratings?.organization || 0), 0) / count).toFixed(2));
      overallAvg = Number((evaluations.reduce((acc, e) => acc + (e.overallRating || 0), 0) / count).toFixed(2));
      satisfiedCount = evaluations.filter((e) => (e.overallRating || 0) >= 4.0).length;
    }

    const satisfactionRate = count > 0 ? Number(((satisfiedCount / count) * 100).toFixed(1)) : 100;

    res.json({
      success: true,
      data: {
        totalEvaluations: count,
        overallAverage: overallAvg,
        satisfactionRate,
        averages: {
          content: avgContent,
          instructor: avgInstructor,
          facilities: avgFacilities,
          organization: avgOrganization,
          overall: overallAvg,
        },
        evaluations,
      },
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  checkEvaluationStatus,
  submitEvaluation,
  submitAgencyEvaluation,
  getEvaluationStatusForCourse,
  getMyEvaluations,
  getEvaluationForCourse,
  adminListEvaluations,
  evaluateCohortAdmin,
  getCohortEvaluationsAdmin,
  getInstructorSummary,
  getAdminSummary,
};
