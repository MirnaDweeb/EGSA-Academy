const Enrollment = require('../models/Enrollment');
const asyncHandler = require('../utils/asyncHandler');
const { sendSuccess } = require('../utils/ApiResponse');
const {
  getProgramCapacitySummary,
  enrollApplication,
  cancelEnrollment,
} = require('../services/enrollmentService');

async function myEnrollments(req, res, next) {
  try {
    const enrollments = await Enrollment.find({ student: req.user._id })
      .populate('course')
      .populate('cohort')
      .sort({ createdAt: -1 });
    res.json({ success: true, data: enrollments });
  } catch (err) {
    next(err);
  }
}

const enrollApplicationAdmin = asyncHandler(async (req, res) => {
  const result = await enrollApplication({
    applicationId: req.params.id,
    adminUser: req.user,
    scopeDivision: req.scopeDivision,
  });
  return sendSuccess(res, 'Application enrolled successfully', result, 201);
});

const getProgramEnrollmentsAdmin = asyncHandler(async (req, res) => {
  const { status, page = 1, limit = 20 } = req.query;
  const filter = { program: req.params.id };
  if (status) filter.status = status;
  if (req.scopeDivision && req.scopeDivision !== 'all') filter.division = req.scopeDivision;

  const pageNum = Math.max(parseInt(page, 10) || 1, 1);
  const limitNum = Math.min(Math.max(parseInt(limit, 10) || 20, 1), 100);

  const total = await Enrollment.countDocuments(filter);
  const enrollments = await Enrollment.find(filter)
    .populate('student', 'fullName email phone')
    .sort({ createdAt: -1 })
    .skip((pageNum - 1) * limitNum)
    .limit(limitNum);

  return sendSuccess(res, 'Program enrollments retrieved', { enrollments }, 200, {
    page: pageNum,
    limit: limitNum,
    total,
    totalPages: Math.ceil(total / limitNum) || 1,
  });
});

const getProgramCapacityAdmin = asyncHandler(async (req, res) => {
  const capacity = await getProgramCapacitySummary(req.params.id);
  return sendSuccess(res, 'Program capacity summary retrieved', capacity);
});

const cancelEnrollmentAdmin = asyncHandler(async (req, res) => {
  const result = await cancelEnrollment({
    enrollmentId: req.params.id,
    adminUser: req.user,
    reason: req.body?.reason,
    scopeDivision: req.scopeDivision,
  });
  return sendSuccess(res, 'Enrollment cancelled successfully', result);
});

module.exports = {
  myEnrollments,
  enrollApplicationAdmin,
  getProgramEnrollmentsAdmin,
  getProgramCapacityAdmin,
  cancelEnrollmentAdmin,
};
