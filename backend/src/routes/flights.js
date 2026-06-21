const router = require('express').Router();
const { body, query } = require('express-validator');
const ctrl = require('../controllers/flightsController');
const { authenticate } = require('../middleware/auth');

const flightBody = [
  body('flight_number').notEmpty().isLength({ max: 10 }),
  body('airline_id').isInt({ min: 1 }),
  body('origin_airport_id').isInt({ min: 1 }),
  body('destination_airport_id').isInt({ min: 1 }),
  body('flight_type').isIn(['arrival', 'departure', 'transit']),
  body('scheduled_departure').isISO8601(),
  body('scheduled_arrival').isISO8601(),
  body('passenger_count').optional().isInt({ min: 0 }),
];

const statusBody = [
  body('status').isIn(['scheduled', 'boarding', 'departed', 'arrived', 'delayed', 'cancelled', 'diverted']),
  body('estimated_departure').optional().isISO8601(),
  body('estimated_arrival').optional().isISO8601(),
  body('actual_departure').optional().isISO8601(),
  body('actual_arrival').optional().isISO8601(),
];

router.get('/',    authenticate, ctrl.listFlights);
router.get('/:id', authenticate, ctrl.getFlight);
router.get('/:id/assignments', authenticate, ctrl.getFlightAssignments);
router.post('/',   authenticate, flightBody, ctrl.createFlight);
router.put('/:id', authenticate, ctrl.updateFlight);
router.patch('/:id/status', authenticate, statusBody, ctrl.updateFlightStatus);

module.exports = router;
