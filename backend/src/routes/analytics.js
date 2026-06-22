const router = require('express').Router();
const ctrl = require('../controllers/analyticsController');
const { authenticate } = require('../middleware/auth');

router.get('/live-stats',          authenticate, ctrl.getLiveStats);
router.get('/airport-comparison',  authenticate, ctrl.getAirportComparison);
router.get('/kpi',                 authenticate, ctrl.getKpiSnapshots);
router.get('/delays',              authenticate, ctrl.getDelayTrends);
router.get('/flight-events',       authenticate, ctrl.getFlightEvents);
router.get('/utilization',         authenticate, ctrl.getResourceUtilization);
router.get('/airlines',            authenticate, ctrl.getAirlinePerformance);
router.get('/delay-heatmap',       authenticate, ctrl.getDelayHeatmap);

module.exports = router;
