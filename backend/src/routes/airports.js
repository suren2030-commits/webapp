const router = require('express').Router();
const db = require('../config/db');
const { authenticate } = require('../middleware/auth');

router.get('/', authenticate, async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT id, iata_code, icao_code, name, city, country, timezone FROM airports ORDER BY name'
    );
    res.json(rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', authenticate, async (req, res, next) => {
  try {
    const [rows] = await db.query(
      'SELECT * FROM airports WHERE id = ?', [req.params.id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Airport not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
