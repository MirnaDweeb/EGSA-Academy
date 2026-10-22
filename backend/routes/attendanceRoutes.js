const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const ctrl = require('../controllers/attendanceController');

// Public policy information
router.get('/policy', ctrl.getPolicy);

// Protected student routes
router.use(protect);

router.get('/summary', ctrl.getSummary);
router.get('/sessions', ctrl.getSessions);
router.post('/check-in', ctrl.checkInWithQR);
router.post('/check-in/qr', ctrl.checkInWithQR);
router.post('/excuse', ctrl.submitAbsenceExcuse);
router.post('/disputes', ctrl.submitDispute);
router.get('/disputes/my', ctrl.getMyDisputes);

// Admin & Instructor routes
router.get('/session/:sessionId/queue', authorize('admin', 'superadmin', 'instructor'), ctrl.getSessionQueue);
router.get('/sessions/:sessionId/queue', authorize('admin', 'superadmin', 'instructor'), ctrl.getSessionQueue);
router.post('/session/:sessionId/verify', authorize('admin', 'superadmin', 'instructor'), ctrl.verifySessionAttendance);
router.post('/sessions/:sessionId/verify', authorize('admin', 'superadmin', 'instructor'), ctrl.verifySessionAttendance);
router.get('/admin/ledger', authorize('admin', 'superadmin', 'instructor'), ctrl.getAdminLedger);
router.post('/sessions/:id/qr', authorize('admin', 'superadmin', 'instructor'), ctrl.generateQR);
router.get('/sessions/:id/roster', authorize('admin', 'superadmin', 'instructor'), ctrl.getSessionRoster);
router.put('/records/:id', authorize('admin', 'superadmin', 'instructor'), ctrl.correctRecord);
router.get('/disputes', authorize('admin', 'superadmin', 'instructor'), ctrl.listDisputes);
router.put('/disputes/:id', authorize('admin', 'superadmin', 'instructor'), ctrl.reviewDispute);

module.exports = router;
