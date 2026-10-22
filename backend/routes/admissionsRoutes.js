const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const { resolveDivisionScope } = require('../middleware/divisionScope');
const ctrl = require('../controllers/admissionsController');

// Student admission endpoints
router.post('/check-eligibility', protect, ctrl.checkEligibility);
router.post('/apply', protect, ctrl.apply);
router.post('/start-flow', protect, ctrl.startFlow);
router.post('/complete-assessment', protect, ctrl.completeAssessment);

// Division Admin endpoints
router.get(
  '/admin/applications',
  protect,
  authorize('admin', 'superadmin', 'super_admin', 'pre_university_admin', 'university_admin'),
  resolveDivisionScope,
  ctrl.listApplicationsForDivisionAdmin
);

const adminMiddlewares = [
  protect,
  authorize('admin', 'superadmin', 'super_admin', 'pre_university_admin', 'university_admin'),
  resolveDivisionScope,
];

router.patch('/admin/applications/:id/override', ...adminMiddlewares, ctrl.approveOverride);
router.post('/admin/applications/:id/override', ...adminMiddlewares, ctrl.approveOverride);

router.patch('/admin/applications/:id/request-info', ...adminMiddlewares, ctrl.requestMoreInfo);
router.post('/admin/applications/:id/request-info', ...adminMiddlewares, ctrl.requestMoreInfo);

router.patch('/admin/applications/:id/reject', ...adminMiddlewares, ctrl.rejectApplication);
router.post('/admin/applications/:id/reject', ...adminMiddlewares, ctrl.rejectApplication);

router.get('/admin/audit-logs', ...adminMiddlewares, ctrl.getAuditLogsForDivisionAdmin);

module.exports = router;

