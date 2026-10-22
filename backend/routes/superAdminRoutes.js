const express = require('express');
const { protect } = require('../middleware/auth');
const {
  requireSuperAdmin,
  getStrategicOverview,
  getAcademyAuditLogs,
  getSystemConfig,
  updateSystemConfig,
} = require('../controllers/superAdminController');

const router = express.Router();

// Strict security layer: All super admin routes require valid JWT and Super Admin role
router.use(protect, requireSuperAdmin);

// 1. Executive Strategic Overview
router.get('/strategic-overview', getStrategicOverview);

// 2. Academy-Wide Master Immutable Audit Trail
router.get('/audit-logs', getAcademyAuditLogs);

// 3. Institutional System Configuration
router.get('/config', getSystemConfig);
router.put('/config', updateSystemConfig);

module.exports = router;
