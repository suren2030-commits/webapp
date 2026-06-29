const router = require('express').Router();
const { authenticate } = require('../middleware/auth');
const { listTracks, getTrack } = require('../controllers/movementsController');

router.get('/',            authenticate, listTracks);
router.get('/:flightId',   authenticate, getTrack);

module.exports = router;
