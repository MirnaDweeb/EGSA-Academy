const Course = require('../models/Course');
const ReadinessQuestion = require('../models/ReadinessQuestion');
const Enrollment = require('../models/Enrollment');

/**
 * Determines effective student division ('PRE_UNIVERSITY' or 'UNIVERSITY').
 */
function getStudentDivision(studentProfile, user = {}) {
  if (studentProfile?.division) return studentProfile.division;
  if (user?.division) return user.division;

  const combined = `${studentProfile?.university || ''} ${studentProfile?.faculty || ''} ${studentProfile?.academicYear || ''}`.toLowerCase();
  if (
    combined.includes('pre-university') ||
    combined.includes('cadet') ||
    combined.includes('grade') ||
    combined.includes('school') ||
    combined.includes('stem')
  ) {
    return 'PRE_UNIVERSITY';
  }
  return 'UNIVERSITY';
}

/**
 * Evaluates whether a student is eligible for a course according to official
 * EgSA specification rules (Sections 4, 5, 6).
 *
 * Rules:
 *   1. Division Match: Pre-University student cannot apply to University-only courses without manual review.
 *   2. Mandatory Prerequisites: Validates whether the student has completed previous prerequisite courses.
 *   3. Experience Evaluation: If prerequisites are missing or experience unverified, flags as 'Foundation Required' or 'Manual Review'.
 */
async function evaluateEligibility(user, studentProfile, course) {
  const missingRequirements = [];
  const reasons = [];
  let status = 'Eligible';
  let recommendedCourse = null;
  let actionableNextSteps = 'Proceed to Readiness Assessment';

  const courseDivision = course.division || 'UNIVERSITY';
  const studentDivision = getStudentDivision(studentProfile, user);
  const divisionMatch = !(studentDivision === 'PRE_UNIVERSITY' && courseDivision === 'UNIVERSITY');

  // Rule 1: Division Match
  // Pre-University student cannot apply to University-only courses without manual review.
  if (!divisionMatch) {
    status = 'Manual Review';
    const msg = 'Pre-University division cadet applying for University-level course requires Academic Affairs manual review and approval.';
    missingRequirements.push(msg);
    reasons.push({ code: 'DIVISION_MISMATCH', message: msg });
    actionableNextSteps = 'Awaiting Academic Affairs Manual Review';
  }

  // Rule 2: Mandatory Prerequisites
  const toIdString = (p) => {
    if (!p) return null;
    if (typeof p === 'object') {
      if (p._id) return p._id.toString();
      if (p.id) return p.id.toString();
    }
    const str = String(p).trim();
    return str.length === 24 ? str : null;
  };

  const rawPrereqs = [
    ...(course.prerequisites || []),
    ...(course.mandatoryPrerequisites || []),
  ];

  // Cache populated documents if already populated
  const populatedMap = new Map();
  rawPrereqs.forEach((p) => {
    if (p && typeof p === 'object' && p._id && p.title) {
      populatedMap.set(p._id.toString(), p);
    }
  });

  const coursePrereqIds = rawPrereqs.map(toIdString).filter(Boolean);
  const uniquePrereqs = [...new Set(coursePrereqIds)];

  if (uniquePrereqs.length > 0) {
    // Check completed courses from profile + confirmed/completed enrollments
    const profileCompleted = (studentProfile?.completedCourses || []).map(toIdString).filter(Boolean);
    let enrollmentCompleted = [];
    try {
      const studentId = user?._id || studentProfile?.user;
      if (studentId) {
        const enrollments = await Enrollment.find({
          student: studentId,
          status: 'Completed',
        }).select('course');
        enrollmentCompleted = enrollments.map((e) => toIdString(e.course)).filter(Boolean);
      }
    } catch (_) {}

    const allCompleted = new Set([...profileCompleted, ...enrollmentCompleted]);
    const missingPrereqIds = uniquePrereqs.filter((p) => !allCompleted.has(p));

    if (missingPrereqIds.length > 0) {
      const needingQuery = missingPrereqIds.filter((id) => !populatedMap.has(id));
      if (needingQuery.length > 0) {
        const fetched = await Course.find({ _id: { $in: needingQuery } }).select('title level price division');
        fetched.forEach((c) => populatedMap.set(c._id.toString(), c));
      }

      const missingCourses = missingPrereqIds.map((id) => populatedMap.get(id)).filter(Boolean);
      status = 'Foundation Required';
      recommendedCourse = missingCourses[0]
        ? {
            _id: missingCourses[0]._id,
            title: missingCourses[0].title,
            level: missingCourses[0].level,
            division: missingCourses[0].division,
          }
        : null;

      const prereqNames = missingCourses.map((c) => c.title).join(', ');
      const msg = `Missing mandatory prerequisite course(s): ${prereqNames}`;
      missingRequirements.push(msg);
      reasons.push({
        code: 'MISSING_PREREQUISITE',
        message: msg,
        recommendedCourse,
      });
      actionableNextSteps = 'Enroll in Recommended Foundation Course';
    }
  }

  // Rule 3: Experience Evaluation
  const minExp = course.minExperience || '';
  const requiredExpList = course.requiredExperience || [];
  if (minExp || requiredExpList.length > 0) {
    const studentExperiences = [
      ...(studentProfile?.experience || []),
      ...(studentProfile?.skills || []),
      studentProfile?.department || '',
      studentProfile?.academicYear || '',
    ].map((e) => e.toLowerCase());

    let experienceSatisfied = true;
    let unmetExp = '';

    if (minExp) {
      const minExpLower = minExp.toLowerCase();
      // If student has no experience listed or doesn't mention relevant keywords
      const hasKeywords = studentExperiences.some((exp) =>
        exp.length > 3 && (minExpLower.includes(exp) || exp.includes('engineering') || exp.includes('physics') || exp.includes('stem'))
      );
      if (!hasKeywords && (studentProfile?.experience || []).length === 0) {
        experienceSatisfied = false;
        unmetExp = minExp;
      }
    }

    if (requiredExpList.length > 0) {
      const missing = requiredExpList.filter(
        (req) => !studentExperiences.some((e) => e.includes(req.toLowerCase()))
      );
      if (missing.length > 0) {
        experienceSatisfied = false;
        unmetExp = unmetExp ? `${unmetExp}; ${missing.join(', ')}` : missing.join(', ');
      }
    }

    if (!experienceSatisfied && status !== 'Foundation Required') {
      status = 'Manual Review';
      const msg = `Minimum experience requirement not verified: ${unmetExp}. Application queued for manual review.`;
      missingRequirements.push(msg);
      reasons.push({ code: 'MISSING_EXPERIENCE', message: msg });
      actionableNextSteps = 'Awaiting Academic Affairs Manual Review';
    }
  }

  // Determine readiness assessment configuration
  let requiresReadiness = true;
  try {
    const exists = await ReadinessQuestion.exists({ course: course._id });
    requiresReadiness = !!exists;
  } catch (_) {
    requiresReadiness = true;
  }

  if (status === 'Eligible') {
    actionableNextSteps = requiresReadiness
      ? 'Proceed to Readiness Assessment'
      : 'Proceed to Seat Reservation & Enrollment';
    reasons.push({ code: 'OK', message: 'All prerequisite and eligibility requirements satisfied.' });
  }

  return {
    isEligible: status === 'Eligible',
    status,
    eligibilityStatus: status,
    divisionMatch,
    studentDivision,
    courseDivision,
    missingRequirements,
    reasons,
    recommendedCourse,
    actionableNextSteps,
    requiresReadiness,
  };
}

/**
 * Backward compatibility wrapper for checkCourseFit.
 */
async function checkCourseFit(studentProfile, course) {
  const evalResult = await evaluateEligibility(null, studentProfile, course);
  return {
    result: evalResult.status,
    reasons: evalResult.reasons,
    missingRequirements: evalResult.missingRequirements,
    recommendedCourse: evalResult.recommendedCourse,
    requiresReadiness: evalResult.requiresReadiness,
  };
}

module.exports = {
  evaluateEligibility,
  checkCourseFit,
  getStudentDivision,
};
