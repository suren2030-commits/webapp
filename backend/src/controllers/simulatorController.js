const db = require('../config/db');
const { startMovement } = require('../services/movementSimulator');

async function getFlights(req, res, next) {
  try {
    const today = new Date().toISOString().slice(0, 10);
    const [rows] = await db.query(`
      SELECT f.id, f.flight_number, f.flight_type, f.status,
             f.scheduled_departure, f.scheduled_arrival,
             a.iata_code AS airline_iata, a.name AS airline_name,
             oa.iata_code AS origin_iata, da.iata_code AS dest_iata
      FROM flights f
      JOIN airlines a  ON f.airline_id = a.id
      JOIN airports oa ON f.origin_airport_id = oa.id
      JOIN airports da ON f.destination_airport_id = da.id
      WHERE (
        (f.flight_type = 'departure' AND DATE(f.scheduled_departure) = ? AND f.origin_airport_id = 1)
        OR
        (f.flight_type = 'arrival'   AND DATE(f.scheduled_arrival)   = ? AND f.destination_airport_id = 1)
      )
      AND f.status IN ('scheduled','boarding','delayed')
      ORDER BY COALESCE(f.scheduled_departure, f.scheduled_arrival) ASC
      LIMIT 200
    `, [today, today]);
    res.json(rows);
  } catch (err) { next(err); }
}

async function sendEvent(req, res, next) {
  try {
    const { flight_id, event, delay_minutes = 0 } = req.body;
    if (!flight_id || !event) return res.status(400).json({ error: 'flight_id and event required' });

    const validEvents = ['boarding', 'departed', 'arrived', 'delayed', 'scheduled'];
    if (!validEvents.includes(event)) return res.status(400).json({ error: `Invalid event. Must be one of: ${validEvents.join(', ')}` });

    const [existing] = await db.query('SELECT id, flight_type, status FROM flights WHERE id = ?', [flight_id]);
    if (!existing.length) return res.status(404).json({ error: 'Flight not found' });

    const now = new Date(Date.now() + delay_minutes * 60000);

    let actualDep = null;
    let actualArr = null;
    if (event === 'departed') actualDep = now;
    if (event === 'arrived')  actualArr = now;

    await db.query(
      `UPDATE flights SET
         status = ?,
         actual_departure = COALESCE(?, actual_departure),
         actual_arrival   = COALESCE(?, actual_arrival),
         updated_at = NOW()
       WHERE id = ?`,
      [event, actualDep, actualArr, flight_id]
    );

    req.app.get('io').to('airport:1').emit('flight:updated', { id: flight_id, status: event });

    // Kick off live movement simulation for departed/arrived events
    if (event === 'departed' || event === 'arrived') {
      const [flightRow] = await db.query(
        `SELECT f.flight_number, g.code AS stand_code
         FROM flights f
         LEFT JOIN gates g ON g.flight_id = f.id AND g.airport_id = 1
         WHERE f.id = ?`,
        [flight_id]
      );
      if (flightRow.length) {
        const movType = event === 'departed' ? 'departure' : 'arrival';
        startMovement(req.app.get('io'), flight_id, flightRow[0].flight_number, movType, flightRow[0].stand_code);
      }
    }

    res.json({ ok: true, flight_id, status: event, actual_departure: actualDep, actual_arrival: actualArr });
  } catch (err) { next(err); }
}

async function scheduleNew(req, res, next) {
  try {
    const {
      flight_number, airline_id, flight_type,
      origin_airport_id, destination_airport_id,
      scheduled_departure, scheduled_arrival,
      passenger_count = 150,
    } = req.body;

    if (!flight_number || !airline_id || !flight_type || !scheduled_departure || !scheduled_arrival) {
      return res.status(400).json({ error: 'Missing required fields: flight_number, airline_id, flight_type, scheduled_departure, scheduled_arrival' });
    }

    const [result] = await db.query(
      `INSERT INTO flights (
         flight_number, airline_id, flight_type,
         origin_airport_id, destination_airport_id,
         scheduled_departure, scheduled_arrival,
         passenger_count, status
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'scheduled')`,
      [
        flight_number.toUpperCase(), airline_id, flight_type,
        origin_airport_id || 1, destination_airport_id || 3,
        scheduled_departure, scheduled_arrival,
        passenger_count,
      ]
    );

    req.app.get('io').to('airport:1').emit('flight:new', {
      id: result.insertId, flight_number: flight_number.toUpperCase(), status: 'scheduled',
    });

    res.status(201).json({ ok: true, flight_id: result.insertId });
  } catch (err) { next(err); }
}

module.exports = { getFlights, sendEvent, scheduleNew };
