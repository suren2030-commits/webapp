const router = require('express').Router();
const ctrl = require('../controllers/auditController');
const { authenticate, requireRole } = require('../middleware/auth');

router.get('/', authenticate, requireRole('admin', 'supervisor'), ctrl.getAuditLog);

module.exports = router;
