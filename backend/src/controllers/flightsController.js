const db = require('../config/db');
const { validationResult } = require('express-validator');

const FLIGHT_SELECT = `
  SELECT
    f.id, f.flight_number, f.flight_type, f.status,
    f.scheduled_departure, f.scheduled_arrival,
    f.estimated_departure, f.estimated_arrival,
    f.actual_departure, f.actual_arrival,
    f.passenger_count, f.aircraft_registration,
    a.id  AS airline_id,  a.iata_code AS airline_iata,  a.name AS airline_name,
    at.id AS aircraft_type_id, at.model AS aircraft_model, at.category AS aircraft_category,
    oa.id AS origin_id,  oa.iata_code AS origin_iata,  oa.name AS origin_name,
    da.id AS dest_id,    da.iata_code AS dest_iata,    da.name AS dest_name,
    g.code AS gate_code, fga.id AS gate_assignment_id
  FROM flights f
  JOIN airlines a        ON f.airline_id = a.id
  LEFT JOIN aircraft_types at  ON f.aircraft_type_id = at.id
  JOIN airports oa       ON f.origin_airport_id = oa.id
  JOIN airports da       ON f.destination_airport_id = da.id
  LEFT JOIN flight_gate_assignments fga ON f.id = fga.flight_id AND fga.status = 'active'
  LEFT JOIN gates g      ON fga.gate_id = g.id
`;

async function listFlights(req, res, next) {
  try {
    const { airport_id, date, status, airline_id, flight_type, page = 1, limit = 50 } = req.query;

    let where = 'WHERE 1=1';
    const params = [];

    // Flight-type-aware airport filter:
    // departures = flights where this airport is the origin
    // arrivals   = flights where this airport is the destination
    if (airport_id) {
      if (flight_type === 'departure') {
        where += ' AND f.origin_airport_id = ?';
        params.push(airport_id);
      } else if (flight_type === 'arrival') {
        where += ' AND f.destination_airport_id = ?';
        params.push(airport_id);
      } else {
        where += ' AND (f.origin_airport_id = ? OR f.destination_airport_id = ?)';
        params.push(airport_id, airport_id);
      }
    }

    // Date filter: use the relevant timestamp per flight type
    if (date) {
      if (flight_type === 'departure') {
        where += ' AND DATE(f.scheduled_departure) = ?';
        params.push(date);
      } else if (flight_type === 'arrival') {
        where += ' AND DATE(f.scheduled_arrival) = ?';
        params.push(date);
      } else {
        where += ' AND (DATE(f.scheduled_departure) = ? OR DATE(f.scheduled_arrival) = ?)';
        params.push(date, date);
      }
    }

    if (status) {
      where += ' AND f.status = ?';
      params.push(status);
    }
    if (airline_id) {
      where += ' AND f.airline_id = ?';
      params.push(airline_id);
    }
    if (flight_type) {
      where += ' AND f.flight_type = ?';
      params.push(flight_type);
    }

    const offset = (parseInt(page) - 1) * parseInt(limit);
    params.push(parseInt(limit), offset);

    const sortCol = flight_type === 'arrival' ? 'f.scheduled_arrival' : 'f.scheduled_departure';
    const [rows] = await db.query(
      `${FLIGHT_SELECT} ${where} ORDER BY ${sortCol} ASC LIMIT ? OFFSET ?`,
      params
    );

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM flights f ${where}`,
      params.slice(0, -2)
    );

    res.json({ data: rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) {
    next(err);
  }
}

async function getFlight(req, res, next) {
  try {
    const [rows] = await db.query(`${FLIGHT_SELECT} WHERE f.id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Flight not found' });
    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

async function createFlight(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const {
      flight_number, airline_id, aircraft_type_id, aircraft_registration,
      origin_airport_id, destination_airport_id, flight_type,
      scheduled_departure, scheduled_arrival, passenger_count,
    } = req.body;

    const [result] = await db.query(
      `INSERT INTO flights
        (flight_number, airline_id, aircraft_type_id, aircraft_registration,
         origin_airport_id, destination_airport_id, flight_type,
         scheduled_departure, scheduled_arrival, passenger_count)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [flight_number, airline_id, aircraft_type_id, aircraft_registration,
       origin_airport_id, destination_airport_id, flight_type,
       scheduled_departure, scheduled_arrival, passenger_count]
    );

    const [rows] = await db.query(`${FLIGHT_SELECT} WHERE f.id = ?`, [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    next(err);
  }
}

async function updateFlight(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const allowed = [
      'aircraft_type_id', 'aircraft_registration', 'flight_type',
      'scheduled_departure', 'scheduled_arrival',
      'estimated_departure', 'estimated_arrival',
      'passenger_count',
    ];

    const fields = Object.keys(req.body).filter(k => allowed.includes(k));
    if (!fields.length) return res.status(400).json({ error: 'No updatable fields provided' });

    const values = fields.map(f => req.body[f]);
    values.push(req.params.id);

    await db.query(
      `UPDATE flights SET ${fields.map(f => `${f} = ?`).join(', ')} WHERE id = ?`,
      values
    );

    const [rows] = await db.query(`${FLIGHT_SELECT} WHERE f.id = ?`, [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Flight not found' });

    res.json(rows[0]);
  } catch (err) {
    next(err);
  }
}

async function updateFlightStatus(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { status, estimated_departure, estimated_arrival, actual_departure, actual_arrival } = req.body;

    const [existing] = await db.query('SELECT id, status FROM flights WHERE id = ?', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Flight not found' });

    await db.query(
      `UPDATE flights SET
        status = ?,
        estimated_departure = COALESCE(?, estimated_departure),
        estimated_arrival   = COALESCE(?, estimated_arrival),
        actual_departure    = COALESCE(?, actual_departure),
        actual_arrival      = COALESCE(?, actual_arrival)
       WHERE id = ?`,
      [status, estimated_departure, estimated_arrival, actual_departure, actual_arrival, req.params.id]
    );

    const [rows] = await db.query(`${FLIGHT_SELECT} WHERE f.id = ?`, [req.params.id]);
    const flight = rows[0];

    // Emit real-time update via socket.io
    req.app.get('io').to(`airport:${flight.origin_id}`).emit('flight:updated', flight);
    req.app.get('io').to(`airport:${flight.dest_id}`).emit('flight:updated', flight);

    res.json(flight);
  } catch (err) {
    next(err);
  }
}

async function getFlightAssignments(req, res, next) {
  try {
    const [gates] = await db.query(
      `SELECT 'gate' AS type, fga.id, fga.status, fga.from_time, fga.to_time, g.code AS resource_code
       FROM flight_gate_assignments fga JOIN gates g ON fga.gate_id = g.id
       WHERE fga.flight_id = ?`,
      [req.params.id]
    );
    const [stands] = await db.query(
      `SELECT 'stand' AS type, fsa.id, fsa.status, fsa.from_time, fsa.to_time, s.code AS resource_code
       FROM flight_stand_assignments fsa JOIN stands s ON fsa.stand_id = s.id
       WHERE fsa.flight_id = ?`,
      [req.params.id]
    );
    const [runways] = await db.query(
      `SELECT 'runway' AS type, fra.id, fra.status, fra.scheduled_time AS from_time, fra.actual_time AS to_time,
              r.designator AS resource_code, fra.assignment_type
       FROM flight_runway_assignments fra JOIN runways r ON fra.runway_id = r.id
       WHERE fra.flight_id = ?`,
      [req.params.id]
    );
    const [groundServices] = await db.query(
      `SELECT fgs.id, fgs.status, fgs.scheduled_start, fgs.scheduled_end, fgs.actual_start, fgs.actual_end,
              gst.name AS service_name, gst.category, gsp.name AS provider_name
       FROM flight_ground_services fgs
       JOIN ground_service_types gst ON fgs.service_type_id = gst.id
       JOIN ground_service_providers gsp ON fgs.provider_id = gsp.id
       WHERE fgs.flight_id = ?`,
      [req.params.id]
    );

    res.json({ gates, stands, runways, ground_services: groundServices });
  } catch (err) {
    next(err);
  }
}

module.exports = { listFlights, getFlight, createFlight, updateFlight, updateFlightStatus, getFlightAssignments };
