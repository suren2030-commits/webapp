const router = require('express').Router();
const ctrl   = require('../controllers/simulatorController');
const { authenticate } = require('../middleware/auth');

router.get('/flights',   authenticate, ctrl.getFlights);
router.post('/event',    authenticate, ctrl.sendEvent);
router.post('/schedule', authenticate, ctrl.scheduleNew);

module.exports = router;
