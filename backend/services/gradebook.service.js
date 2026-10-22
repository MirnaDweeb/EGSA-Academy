const { Cohort, Course, Session, Attendance, Assessment, AssessmentSubmission, AssessmentResult, EnrollmentReference, User } = require('../models');
const TrainingSession = require('../models/TrainingSession');
const AttendanceRecord = require('../models/AttendanceRecord');
const StudentSubmission = require('../models/StudentSubmission');
const Enrollment = require('../models/Enrollment');
const Evaluation = require('../models/Evaluation');
const { ownedCohort } = require('./ownership.service');
const ApiError = require('../utils/ApiError');
const assessmentService = require('./assessmentService');

/**
 * Computes overall academic standing based on EgSA criteria
 * - Distinction: Cumulative Score >= 90% AND Attendance >= 85%
 * - Good Standing: Cumulative Score >= 70% AND Attendance >= 85%
 * - At Risk: Attendance < 85% OR Cumulative Score < 70%
 * - Academic Warning: Attendance < 75% OR Cumulative Score < 60%
 */
function calculateAcademicStanding(cumulativeScore, attendancePercentage) {
  if (attendancePercentage >= 85 && cumulativeScore >= 90) {
    return 'Distinction';
  }
  if (attendancePercentage >= 85 && cumulativeScore >= 70) {
    return 'Good Standing';
  }
  if (attendancePercentage < 75 || cumulativeScore < 60) {
    return 'Academic Warning';
  }
  return 'At Risk';
}

/**
 * Aggregates complete gradebook metrics for a given cohort assigned to the instructor.
 */
async function getGradebook(instructorId, cohortId) {
  const cohort = await ownedCohort(instructorId, cohortId);
  if (!cohort) {
    throw ApiError.notFound('Cohort not found or unauthorized.');
  }

  // 1. Fetch Course details
  const course = await Course.findById(cohort.course).lean();

  // 2. Fetch all cohort sessions (dual-model support, excluding cancelled)
  const [sessDocs, trainSessDocs] = await Promise.all([
    Session.find({ cohort: cohortId, status: { $ne: 'cancelled' } }).select('_id title date status').lean(),
    TrainingSession.find({ cohort: cohortId, status: { $nin: ['Cancelled', 'cancelled'] } }).select('_id title date status').lean(),
  ]);

  // Consolidate unique session identifiers
  const sessionTitleMap = new Map();
  const idToCanonicalMap = new Map();
  for (const s of [...sessDocs, ...trainSessDocs]) {
    const key = (s.title || '').trim().toLowerCase();
    if (!sessionTitleMap.has(key)) {
      sessionTitleMap.set(key, s);
    }
    idToCanonicalMap.set(String(s._id), key);
  }
  const totalSessions = Math.max(sessionTitleMap.size, 1);
  const allSessionIds = [...sessDocs.map((s) => s._id), ...trainSessDocs.map((s) => s._id)];

  // 3. Fetch all Assessments for this cohort
  const assessments = await Assessment.find({
    cohort: cohortId,
    status: { $ne: 'Draft' },
  })
    .sort({ createdAt: 1 })
    .lean();

  // If no assessments found with status !== 'Draft', get all cohort assessments
  const effectiveAssessments = assessments.length
    ? assessments
    : await Assessment.find({ cohort: cohortId }).sort({ createdAt: 1 }).lean();

  // 4. Fetch enrolled students (Merge Enrollment and EnrollmentReference)
  const [enrollments, enrollmentRefs] = await Promise.all([
    Enrollment.find({
      cohort: cohortId,
      status: { $in: ['Active', 'Confirmed', 'Completed', 'enrolled', 'active', 'CONFIRMED'] },
    })
      .populate('student')
      .lean(),
    EnrollmentReference.find({ cohort: cohortId }).populate('student').lean(),
  ]);

  const studentMap = new Map();
  const enrollmentMap = new Map();

  for (const enr of enrollments) {
    if (enr.student && enr.student._id) {
      const email = (enr.student.email || '').toLowerCase().trim();
      const sid = String(enr.student._id);
      const key = email || sid;
      studentMap.set(key, {
        ...enr.student,
        _id: enr.student._id,
        userModelId: sid,
        email,
      });
      enrollmentMap.set(key, enr);
    }
  }

  for (const ref of enrollmentRefs) {
    if (ref.student && ref.student._id) {
      const email = (ref.student.email || '').toLowerCase().trim();
      const extId = ref.student.externalStudentId;
      const key = email || extId || String(ref.student._id);
      if (!studentMap.has(key)) {
        studentMap.set(key, {
          _id: ref.student._id,
          fullName: ref.student.name || 'Cadet',
          email: ref.student.email,
          externalStudentId: extId,
          userModelId: extId || String(ref.student._id),
          refStudentId: String(ref.student._id),
        });
      } else {
        const existing = studentMap.get(key);
        if (!existing.externalStudentId && extId) {
          existing.externalStudentId = extId;
        }
        if (!existing.refStudentId) {
          existing.refStudentId = String(ref.student._id);
        }
      }
    }
  }

  const studentList = Array.from(studentMap.values());
  const allKnownIds = new Set();
  studentList.forEach((s) => {
    if (s._id) allKnownIds.add(String(s._id));
    if (s.userModelId) allKnownIds.add(String(s.userModelId));
    if (s.externalStudentId) allKnownIds.add(String(s.externalStudentId));
    if (s.refStudentId) allKnownIds.add(String(s.refStudentId));
  });
  const studentIds = Array.from(allKnownIds);

  // 5. Bulk fetch Attendance, Submissions, Results & Evaluations
  const [attRecords, attendances, studentSubs, legacySubs, results, evalRecords] = await Promise.all([
    AttendanceRecord.find({ cohort: cohortId, student: { $in: studentIds } }).lean(),
    Attendance.find({ cohort: cohortId, student: { $in: studentIds } }).lean(),
    StudentSubmission.find({ cohort: cohortId, student: { $in: studentIds } }).lean(),
    AssessmentSubmission.find({ cohort: cohortId, student: { $in: studentIds } }).lean(),
    AssessmentResult.find({ cohort: cohortId, student: { $in: studentIds } }).lean(),
    Evaluation.find({ cohort: cohortId, student: { $in: studentIds } }).lean(),
  ]);

  // Index metrics by studentId
  const studentMetrics = [];
  let cumulativeScoreSum = 0;
  let studentsWithScores = 0;
  let attendanceGateCompliantCount = 0;
  let flaggedAtRiskCount = 0;

  for (const student of studentList) {
    const key = (student.email || '').toLowerCase().trim() || String(student._id);
    const enrollment = enrollmentMap.get(key);
    const possibleIds = new Set(
      [
        String(student._id || ''),
        String(student.userModelId || ''),
        String(student.externalStudentId || ''),
        String(student.refStudentId || ''),
      ].filter(Boolean)
    );

    // --- A. Attendance Calculation ---
    // Count verified or present records across both models
    const sAttRecords = attRecords.filter((a) => possibleIds.has(String(a.student)));
    const sAttendances = attendances.filter((a) => possibleIds.has(String(a.student)));

    // Track unique sessions attended
    const attendedSessionsSet = new Set();
    sAttRecords.forEach((a) => {
      const st = String(a.status || '').toLowerCase();
      if (st === 'verified' || st === 'present' || a.verified === true) {
        const canonical = idToCanonicalMap.get(String(a.session)) || String(a.session);
        attendedSessionsSet.add(canonical);
      }
    });
    sAttendances.forEach((a) => {
      const st = String(a.status || '').toLowerCase();
      if (st === 'present' || st === 'late' || a.verified === true) {
        const canonical = idToCanonicalMap.get(String(a.session)) || String(a.session);
        attendedSessionsSet.add(canonical);
      }
    });

    const sessionsAttended = Math.min(attendedSessionsSet.size, totalSessions);
    const attendancePercentage = Math.min(100, Math.round((sessionsAttended / totalSessions) * 100));
    const attendanceAtRisk = attendancePercentage < 85;

    if (!attendanceAtRisk) {
      attendanceGateCompliantCount++;
    }

    // --- B. Technical Assessments Calculation ---
    const sStudentSubs = studentSubs.filter((s) => possibleIds.has(String(s.student)));
    const sLegacySubs = legacySubs.filter((s) => possibleIds.has(String(s.student)));
    const sResults = results.filter((r) => possibleIds.has(String(r.student)));

    let totalPointsEarned = 0;
    let totalMaxPoints = 0;
    let gradedCount = 0;

    const assessmentScores = effectiveAssessments.map((ass) => {
      const assId = String(ass._id);
      const maxScore = ass.maxScore || (ass.gradingConfig && ass.gradingConfig.maxScore) || 100;
      const weight = ass.weight || 1;

      // Find result or submission
      const result = sResults.find((r) => String(r.assessment) === assId);
      const sub = sStudentSubs.find((s) => String(s.assessment) === assId) ||
                  sLegacySubs.find((s) => String(s.assessment) === assId);

      let score = null;
      let status = 'Missing';
      let submissionId = sub?._id || result?.submission || null;
      let feedback = result?.feedback || sub?.feedback || '';

      if (result && result.score != null) {
        score = result.score;
        status = 'Graded';
        gradedCount++;
      } else if (sub && sub.score != null) {
        score = sub.score;
        status = 'Graded';
        gradedCount++;
      } else if (sub) {
        status = sub.status === 'Graded' ? 'Graded' : 'Submitted';
      }

      if (score != null) {
        totalPointsEarned += (score / maxScore) * weight;
      }
      totalMaxPoints += weight;

      return {
        assessmentId: ass._id,
        title: ass.title,
        type: ass.type || 'assignment',
        maxScore,
        score,
        percentage: score != null ? Math.round((score / maxScore) * 100) : null,
        status,
        isSubmitted: Boolean(submissionId || score != null || status === 'Submitted' || status === 'Graded'),
        submissionId,
        feedback,
      };
    });

    // --- C. Cumulative Academic Score ---
    const cumulativeScore = totalMaxPoints > 0 ? Math.round((totalPointsEarned / totalMaxPoints) * 100) : 0;
    if (gradedCount > 0) {
      cumulativeScoreSum += cumulativeScore;
      studentsWithScores++;
    }

    // --- D. Quality Evaluation Status ---
    const evalRecord = evalRecords.find((e) => possibleIds.has(String(e.student)));
    const evaluationCompleted = Boolean(enrollment?.evaluationCompleted || evalRecord);

    // --- E. Overall Academic Standing ---
    const academicStanding = calculateAcademicStanding(cumulativeScore, attendancePercentage);
    if (academicStanding === 'At Risk' || academicStanding === 'Academic Warning' || attendanceAtRisk) {
      flaggedAtRiskCount++;
    }

    const attendanceData = {
      sessionsAttended,
      totalSessions,
      attendancePercentage,
      attendanceAtRisk,
    };

    studentMetrics.push({
      studentId: student._id,
      fullName: student.fullName || student.name || 'Cadet',
      email: student.email || '',
      nationalId: student.nationalId || student.externalStudentId || '—',
      attendance: attendanceData,
      attendanceHealth: attendanceData,
      assessments: assessmentScores,
      technicalAssessments: assessmentScores,
      cumulativeScore,
      evaluationCompleted,
      academicStanding,
    });
  }

  // --- KPI Summaries ---
  const totalEnrolled = studentList.length;
  const classAverageScore = studentsWithScores > 0 ? Math.round(cumulativeScoreSum / studentsWithScores) : 0;
  const kpiData = {
    totalEnrolled,
    totalStudents: totalEnrolled,
    classAverageScore,
    attendanceGateHealth: attendanceGateCompliantCount,
    flaggedAtRiskCount,
    atRiskCount: flaggedAtRiskCount,
  };

  return {
    cohort: {
      _id: cohort._id,
      name: cohort.name,
      status: cohort.status,
      startDate: cohort.startDate,
      endDate: cohort.endDate,
    },
    course: course
      ? {
          _id: course._id,
          title: course.title || course.name,
          code: course.code,
        }
      : null,
    assessments: effectiveAssessments.map((a) => ({
      _id: a._id,
      title: a.title,
      type: a.type || 'assignment',
      maxScore: a.maxScore || (a.gradingConfig && a.gradingConfig.maxScore) || 100,
    })),
    students: studentMetrics,
    kpis: kpiData,
    summary: kpiData,
  };
}

/**
 * Handles batch or single quick-grade updates and recalculates academic standing.
 */
async function quickGrade(instructorId, cohortId, payload) {
  const cohort = await ownedCohort(instructorId, cohortId);
  if (!cohort) {
    throw ApiError.notFound('Cohort not found or unauthorized.');
  }

  const updates = Array.isArray(payload)
    ? payload
    : Array.isArray(payload?.updates)
    ? payload.updates
    : [payload];

  if (!updates.length) {
    throw ApiError.badRequest('No grade updates provided.');
  }

  const instructorUser = await User.findById(instructorId);
  const updatedResults = [];

  for (const item of updates) {
    const { submissionId, studentId, assessmentId, score, feedback } = item;
    const numericScore = Number(score);

    if (isNaN(numericScore) || numericScore < 0) {
      throw ApiError.badRequest('Score must be a non-negative number.');
    }

    let subId = submissionId;

    // If studentId and assessmentId provided without submissionId, locate or create submission
    if (!subId && studentId && assessmentId) {
      let sub = await StudentSubmission.findOne({ cohort: cohortId, student: studentId, assessment: assessmentId });
      if (!sub) {
        sub = await StudentSubmission.create({
          cohort: cohortId,
          student: studentId,
          assessment: assessmentId,
          course: cohort.course,
          status: 'Submitted',
          submittedAt: new Date(),
        });
      }
      subId = sub._id;
    }

    if (!subId) {
      throw ApiError.badRequest('A valid submissionId or studentId + assessmentId is required.');
    }

    // Use assessmentService.gradeSubmission for complete update + result publication + notification
    const gradeResult = await assessmentService.gradeSubmission(subId, instructorUser, {
      score: numericScore,
      feedback: feedback || '',
      notes: feedback || '',
    });

    // Also update AssessmentSubmission model if exists for dual-model parity
    await AssessmentSubmission.findByIdAndUpdate(subId, {
      $set: {
        score: numericScore,
        feedback: feedback || '',
        gradedBy: instructorId,
        gradedAt: new Date(),
        status: 'Graded',
      },
    }).catch(() => null);

    updatedResults.push({
      submissionId: subId,
      score: numericScore,
      feedback: feedback || '',
      gradeResult,
    });
  }

  // Fetch updated gradebook metrics for the cohort
  const freshGradebook = await getGradebook(instructorId, cohortId);

  return {
    success: true,
    updatedCount: updatedResults.length,
    results: updatedResults,
    freshGradebook,
  };
}

/**
 * Generates official institutional CSV ledger for archiving.
 */
async function exportGradebookCsv(instructorId, cohortId) {
  const data = await getGradebook(instructorId, cohortId);
  const assessments = data.assessments || [];
  const students = data.students || [];

  // Build CSV Header
  const headers = [
    'Student ID',
    'Student Name',
    'Email',
    'National ID',
    'Attendance Rate (%)',
    'Sessions Attended',
    'Total Sessions',
    'Attendance Risk Status',
    ...assessments.map((a) => `"${a.title.replace(/"/g, '""')} (Max: ${a.maxScore})"`),
    'Cumulative Score (%)',
    'Quality Evaluation Completed',
    'Overall Academic Standing',
  ];

  const rows = students.map((s) => {
    const scores = assessments.map((a) => {
      const match = s.assessments.find((ass) => String(ass.assessmentId) === String(a._id));
      return match && match.score != null ? match.score : 'N/A';
    });

    return [
      `"${String(s.studentId).replace(/"/g, '""')}"`,
      `"${String(s.fullName).replace(/"/g, '""')}"`,
      `"${String(s.email).replace(/"/g, '""')}"`,
      `"${String(s.nationalId).replace(/"/g, '""')}"`,
      s.attendance.attendancePercentage,
      s.attendance.sessionsAttended,
      s.attendance.totalSessions,
      s.attendance.attendanceAtRisk ? 'YES' : 'NO',
      ...scores,
      s.cumulativeScore,
      s.evaluationCompleted ? 'YES' : 'NO',
      `"${s.academicStanding}"`,
    ].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\r\n');
  const safeCohortName = (data.cohort.name || 'Cohort').replace(/[^a-zA-Z0-9_-]/g, '_');
  const filename = `EgSA_Gradebook_${safeCohortName}_${new Date().toISOString().slice(0, 10)}.csv`;

  return {
    csvContent,
    filename,
  };
}

module.exports = {
  getGradebook,
  quickGrade,
  exportGradebookCsv,
  calculateAcademicStanding,
};
