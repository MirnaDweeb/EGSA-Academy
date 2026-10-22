const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/evaluationController');

router.use(protect);

// Student endpoints
router.get('/check/:cohortId', ctrl.checkEvaluationStatus);
router.post('/', ctrl.submitEvaluation);
router.post('/course', ctrl.submitEvaluation);
router.post('/agency', ctrl.submitAgencyEvaluation);
router.get('/my', ctrl.getMyEvaluations);
router.get('/status/:courseId', ctrl.getEvaluationStatusForCourse);
router.get('/course/:courseId', ctrl.getEvaluationForCourse);

// Instructor endpoints
router.get('/instructor/summary', authorize('instructor', 'admin', 'super_admin', 'superadmin'), ctrl.getInstructorSummary);

// Admin endpoints
router.get('/admin/summary', authorize('admin', 'super_admin', 'superadmin', 'pre_university_admin', 'university_admin'), ctrl.getAdminSummary);
router.get('/admin', authorize('admin', 'superadmin', 'super_admin'), ctrl.adminListEvaluations);

module.exports = router;
