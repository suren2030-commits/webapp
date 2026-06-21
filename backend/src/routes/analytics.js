const router = require('express').Router();
const ctrl = require('../controllers/analyticsController');
const { authenticate } = require('../middleware/auth');

router.get('/live-stats',    authenticate, ctrl.getLiveStats);
router.get('/kpi',           authenticate, ctrl.getKpiSnapshots);
router.get('/delays',        authenticate, ctrl.getDelayTrends);
router.get('/flight-events', authenticate, ctrl.getFlightEvents);
router.get('/utilization',   authenticate, ctrl.getResourceUtilization);

module.exports = router;
