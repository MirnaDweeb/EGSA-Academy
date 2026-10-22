const assessmentService = require('../services/assessmentService');

async function createAssessment(req, res, next) {
  try {
    const assessment = await assessmentService.createAssessment(req.user, req.body);
    res.status(201).json({
      success: true,
      message: 'Assessment defined successfully.',
      data: assessment,
    });
  } catch (err) {
    next(err);
  }
}

async function updateAssessment(req, res, next) {
  try {
    const assessment = await assessmentService.updateAssessment(req.params.id, req.user, req.body);
    res.json({
      success: true,
      message: 'Assessment updated successfully.',
      data: assessment,
    });
  } catch (err) {
    next(err);
  }
}

async function getAssessmentById(req, res, next) {
  try {
    const data = await assessmentService.getAssessmentById(req.params.id, req.user);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function listAssessments(req, res, next) {
  try {
    const assessments = await assessmentService.listAssessments(req.user, req.query);
    res.json({ success: true, data: assessments });
  } catch (err) {
    next(err);
  }
}

async function getCohortStudents(req, res, next) {
  try {
    const data = await assessmentService.getCohortStudentsForAssessment(req.params.id, req.user);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function recordEvaluation(req, res, next) {
  try {
    const result = await assessmentService.recordEvaluation(
      req.params.id,
      req.params.studentId,
      req.user,
      req.body
    );
    res.json({
      success: true,
      message: result.status === 'Draft' ? 'Evaluation draft saved.' : 'Evaluation recorded and finalized.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function finalizeEvaluation(req, res, next) {
  try {
    const result = await assessmentService.finalizeEvaluation(req.params.resultId, req.user);
    res.json({
      success: true,
      message: 'Evaluation finalized and locked.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function publishEvaluation(req, res, next) {
  try {
    const result = await assessmentService.publishEvaluation(req.params.resultId, req.user);
    res.json({
      success: true,
      message: 'Evaluation published to student.',
      data: result,
    });
  } catch (err) {
    next(err);
  }
}

async function getMyAssessments(req, res, next) {
  try {
    const data = await assessmentService.getStudentAssessments(req.user._id, req.query);
    res.json({ success: true, data });
  } catch (err) {
    next(err);
  }
}

async function getOverviewStats(req, res, next) {
  try {
    const stats = await assessmentService.getOverviewStats(req.user);
    res.json({ success: true, data: stats });
  } catch (err) {
    next(err);
  }
}

async function submitAssessment(req, res, next) {
  try {
    const submission = await assessmentService.submitAssessment(
      req.params.id,
      req.user,
      req.body,
      req.file
    );
    res.status(201).json({
      success: true,
      message: 'Assessment submitted successfully.',
      data: submission,
    });
  } catch (err) {
    next(err);
  }
}

async function downloadAttachment(req, res, next) {
  try {
    await assessmentService.downloadAttachment(
      req.params.id,
      req.params.filename,
      req.user,
      res,
      req.query.view === 'true'
    );
  } catch (err) {
    next(err);
  }
}

async function downloadSubmissionFile(req, res, next) {
  try {
    await assessmentService.downloadSubmissionFile(
      req.params.submissionId,
      req.user,
      res,
      req.query.view === 'true'
    );
  } catch (err) {
    next(err);
  }
}

// Admin aliases and handlers
const createAssessmentAdmin = createAssessment;
const listAssessmentsAdmin = listAssessments;
const getAssessmentByIdAdmin = getAssessmentById;
const updateAssessmentAdmin = updateAssessment;

async function toggleAssessmentStatusAdmin(req, res, next) {
  try {
    const { Assessment } = require('../models');
    if (!Assessment) return res.json({ success: true, message: 'Assessment status toggled' });
    const assessment = await Assessment.findById(req.params.id);
    if (!assessment) return res.status(404).json({ success: false, message: 'Assessment not found' });
    assessment.status = assessment.status === 'Published' ? 'Draft' : 'Published';
    await assessment.save();
    res.json({ success: true, message: 'Assessment status toggled', data: assessment });
  } catch (err) {
    next(err);
  }
}

async function deleteAssessmentAdmin(req, res, next) {
  try {
    const { Assessment } = require('../models');
    if (Assessment) await Assessment.findByIdAndDelete(req.params.id);
    res.json({ success: true, message: 'Assessment deleted successfully' });
  } catch (err) {
    next(err);
  }
}

async function listAttemptsForAssessmentAdmin(req, res, next) {
  try {
    const { AssessmentSubmission } = require('../models');
    const attempts = AssessmentSubmission
      ? await AssessmentSubmission.find({ assessment: req.params.id }).populate('student', 'fullName email')
      : [];
    res.json({ success: true, data: { attempts: attempts || [] } });
  } catch (err) {
    next(err);
  }
}

async function getAssessmentsForProgramStudent(req, res, next) {
  try {
    const { Assessment } = require('../models');
    const assessments = Assessment
      ? await Assessment.find({
          $or: [{ program: req.params.programId }, { course: req.params.programId }],
          status: 'Published',
        }).sort({ createdAt: -1 })
      : [];
    res.json({ success: true, data: { assessments: assessments || [] } });
  } catch (err) {
    next(err);
  }
}

async function getAssessmentByIdStudent(req, res, next) {
  try {
    const { Assessment } = require('../models');
    if (!Assessment) return res.status(404).json({ success: false, message: 'Assessment not found' });
    const assessment = await Assessment.findById(req.params.id);
    if (!assessment) return res.status(404).json({ success: false, message: 'Assessment not found' });
    res.json({ success: true, data: { assessment } });
  } catch (err) {
    next(err);
  }
}

async function submitAssessmentAttemptStudent(req, res, next) {
  try {
    const { AssessmentSubmission } = require('../models');
    if (!AssessmentSubmission) {
      return res.status(201).json({ success: true, message: 'Assessment submitted successfully' });
    }
    const submission = await AssessmentSubmission.create({
      assessment: req.params.id,
      student: req.user._id,
      answers: req.body?.answers || [],
      content: req.body?.content || '',
      status: 'Submitted',
      submittedAt: new Date(),
    });
    res.status(201).json({ success: true, message: 'Assessment submitted successfully', data: { submission } });
  } catch (err) {
    next(err);
  }
}

async function getMyAssessmentAttemptsStudent(req, res, next) {
  try {
    const { AssessmentSubmission } = require('../models');
    const attempts = AssessmentSubmission
      ? await AssessmentSubmission.find({ student: req.user._id })
          .populate('assessment')
          .sort({ createdAt: -1 })
      : [];
    res.json({ success: true, data: { attempts: attempts || [] } });
  } catch (err) {
    next(err);
  }
}

async function submitQuiz(req, res, next) {
  try {
    const answers = req.body?.answers !== undefined ? req.body.answers : req.body;
    const result = await assessmentService.submitQuiz(req.params.id, req.user, answers);
    res.status(201).json({
      success: true,
      message: `Quiz evaluated successfully: ${result.score}/${result.maxScore} (${result.percentage}%) - ${result.resultLabel}.`,
      data: result,
      score: result.score,
      maxScore: result.maxScore,
      percentage: result.percentage,
      passed: result.passed,
      resultLabel: result.resultLabel,
      answers: result.answers,
    });
  } catch (err) {
    next(err);
  }
}

async function submitAssignment(req, res, next) {
  try {
    const result = await assessmentService.submitAssignment(
      req.params.id,
      req.user,
      req.body,
      req.file
    );
    res.status(201).json({
      success: true,
      message: result.isLate
        ? `Assignment submitted ${result.minutesLate} minute(s) past deadline.`
        : 'Assignment submitted successfully.',
      data: result,
      isLate: result.isLate,
      minutesLate: result.minutesLate,
      submission: result.submission,
    });
  } catch (err) {
    next(err);
  }
}

async function getAssessmentSubmissions(req, res, next) {
  try {
    const result = await assessmentService.getAssessmentSubmissions(req.params.id, req.user);
    res.json({
      success: true,
      data: result,
      submissions: result.submissions,
      totalSubmissions: result.totalSubmissions,
    });
  } catch (err) {
    next(err);
  }
}

async function gradeSubmission(req, res, next) {
  try {
    const submissionId = req.params.submissionId || req.params.id;
    const result = await assessmentService.gradeSubmission(submissionId, req.user, req.body);
    res.json({
      success: true,
      message: `Submission graded successfully: ${result.score}/${result.maxScore} (${result.percentage}%).`,
      data: result,
      submission: result.submission,
      score: result.score,
      feedback: result.feedback,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = {
  createAssessment,
  updateAssessment,
  getAssessmentById,
  listAssessments,
  getCohortStudents,
  recordEvaluation,
  finalizeEvaluation,
  publishEvaluation,
  getMyAssessments,
  submitAssessment,
  submitQuiz,
  submitAssignment,
  getAssessmentSubmissions,
  gradeSubmission,
  downloadAttachment,
  downloadSubmissionFile,
  getOverviewStats,
  createAssessmentAdmin,
  listAssessmentsAdmin,
  getAssessmentByIdAdmin,
  updateAssessmentAdmin,
  toggleAssessmentStatusAdmin,
  deleteAssessmentAdmin,
  listAttemptsForAssessmentAdmin,
  getAssessmentsForProgramStudent,
  getAssessmentByIdStudent,
  submitAssessmentAttemptStudent,
  getMyAssessmentAttemptsStudent,
};
