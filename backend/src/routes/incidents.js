const router = require('express').Router();
const { body } = require('express-validator');
const ctrl = require('../controllers/incidentsController');
const { authenticate } = require('../middleware/auth');

const createBody = [
  body('airport_id').isInt({ min: 1 }),
  body('title').notEmpty().isLength({ max: 200 }),
  body('type').isIn(['technical','weather','security','medical','operational','fire','other']),
  body('severity').isIn(['low','medium','high','critical']),
];

router.get('/stats',   authenticate, ctrl.getStats);
router.get('/',        authenticate, ctrl.listIncidents);
router.get('/:id',     authenticate, ctrl.getIncident);
router.post('/',       authenticate, createBody, ctrl.createIncident);
router.patch('/:id',   authenticate, ctrl.updateIncident);
router.post('/:id/updates', authenticate, ctrl.addUpdate);

module.exports = router;
