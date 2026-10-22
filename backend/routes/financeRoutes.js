const router = require('express').Router();
const { protect, authorize } = require('../middleware/auth');
const { resolveDivisionScope } = require('../middleware/divisionScope');
const ctrl = require('../controllers/financeController');

const adminMiddlewares = [
  protect,
  authorize('admin', 'superadmin', 'super_admin', 'university_admin', 'pre_university_admin'),
  resolveDivisionScope,
];

// 1. Financial Overview KPIs
router.get('/overview', ...adminMiddlewares, ctrl.getFinancialOverview);

// 2. Interactive Commercial Invoices Ledger
router.get('/invoices', ...adminMiddlewares, ctrl.getInvoicesLedger);

// 3. Sponsorship & Tuition Waiver Engine
router.post('/invoices/:id/waive', ...adminMiddlewares, ctrl.applySponsorWaiver);
router.post('/invoices/:id/sponsor-waiver', ...adminMiddlewares, ctrl.applySponsorWaiver);

// 4. Automated 72-Hour Expiration & Waitlist Promotion Sweep
router.post('/sweep-expired', ...adminMiddlewares, ctrl.sweepExpiredInvoices);
router.post('/check-deadlines', ...adminMiddlewares, ctrl.sweepExpiredInvoices);

// 5. Refund Processing
router.post('/invoices/:id/refund', ...adminMiddlewares, ctrl.processInvoiceRefund);

module.exports = router;
