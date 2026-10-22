const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const { resolveDivisionScope } = require('../middleware/divisionScope');
const ctrl = require('../controllers/readinessController');

const ADMIN_ROLES = ['admin', 'superadmin', 'super_admin', 'pre_university_admin', 'university_admin'];

// 1. Course Questions & Readiness Engine Core Routes
router.get('/course/:courseId', protect, ctrl.getCourseQuestions);
router.post('/submit', protect, ctrl.submitAssessment);

// 2. Division Admin Readiness Oversight & Override Routes
router.get('/admin/attempts', protect, authorize(...ADMIN_ROLES), resolveDivisionScope, ctrl.listAdminAttempts);
router.post('/admin/override/:attemptId', protect, authorize(...ADMIN_ROLES), ctrl.adminOverrideAttempt);

// 3. Admin Question Bank Authoring Routes
router.post('/admin/questions', protect, authorize(...ADMIN_ROLES), ctrl.adminCreateQuestion);
router.post('/admin/questions/bulk', protect, authorize(...ADMIN_ROLES), ctrl.adminBulkCreateQuestions);
router.get('/admin/questions', protect, authorize(...ADMIN_ROLES), ctrl.adminListQuestions);
router.delete('/admin/questions/:questionId', protect, authorize(...ADMIN_ROLES), ctrl.adminDeleteQuestion);

// 4. Student Session & Attempt Lifecycle Routes (Backwards Compatibility)
router.post('/start', protect, ctrl.startAssessment);
router.get('/status/:courseId', protect, ctrl.getAssessmentStatus);
router.get('/:attemptId', protect, ctrl.getAttempt);
router.post('/:attemptId/submit', protect, ctrl.submitAssessment);
router.get('/:attemptId/result', protect, ctrl.getResult);

module.exports = router;
