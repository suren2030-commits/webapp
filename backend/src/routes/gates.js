const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/gatesController');
const { authenticate } = require('../middleware/auth');

router.get('/',              authenticate, ctrl.listGates);
router.get('/terminals',     authenticate, ctrl.listTerminals);
router.post('/:gate_id/assign', authenticate, [
  body('flight_id').isInt({ min: 1 }),
  body('from_time').isISO8601(),
  body('to_time').isISO8601(),
], ctrl.assignFlight);
router.patch('/assignments/:id', authenticate, [
  body('status').isIn(['planned','active','completed','cancelled']),
], ctrl.updateAssignment);

module.exports = router;
