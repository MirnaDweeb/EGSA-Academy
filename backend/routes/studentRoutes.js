const router = require('express').Router();
const { protect } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const { updateProfileValidator, setGoalValidator } = require('../validators/studentValidators');
const ctrl = require('../controllers/studentController');

const certCtrl = require('../controllers/certificateController');

router.use(protect);
router.get(['/profile', '/me'], ctrl.getProfile);
router.put(['/profile', '/me'], validate(updateProfileValidator), ctrl.updateProfile);
router.post(['/profile/goal', '/me/goal'], validate(setGoalValidator), ctrl.setGoal);

// Certificates & Official Clearance (إفادة) endpoints for student portal
router.get('/mine/certificates', certCtrl.myCertificates);
router.get('/mine/certificates/:id/pdf', certCtrl.downloadCertificate);
router.get('/me/certificates', certCtrl.myCertificates);

module.exports = router;
