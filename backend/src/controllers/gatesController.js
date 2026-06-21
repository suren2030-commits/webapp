const db = require('../config/db');
const { validationResult } = require('express-validator');

async function listGates(req, res, next) {
  try {
    const { airport_id, terminal_id, status } = req.query;
    let where = 'WHERE 1=1';
    const params = [];

    if (airport_id) { where += ' AND t.airport_id = ?'; params.push(airport_id); }
    if (terminal_id) { where += ' AND g.terminal_id = ?'; params.push(terminal_id); }
    if (status) { where += ' AND g.status = ?'; params.push(status); }

    const [rows] = await db.query(`
      SELECT
        g.id, g.code, g.type, g.max_category, g.has_jetbridge, g.status,
        t.id AS terminal_id, t.code AS terminal_code, t.name AS terminal_name, t.airport_id,
        a.iata_code AS airport_iata,
        fga.id AS assignment_id, fga.flight_id, fga.from_time, fga.to_time,
        fga.status AS assignment_status,
        f.flight_number, f.status AS flight_status,
        al.iata_code AS airline_iata,
        oa.iata_code AS origin_iata,
        da.iata_code AS dest_iata
      FROM gates g
      JOIN terminals t ON g.terminal_id = t.id
      JOIN airports a  ON t.airport_id = a.id
      LEFT JOIN flight_gate_assignments fga
        ON g.id = fga.gate_id
        AND fga.status IN ('planned','active')
        AND fga.to_time >= NOW()
      LEFT JOIN flights f   ON fga.flight_id = f.id
      LEFT JOIN airlines al ON f.airline_id = al.id
      LEFT JOIN airports oa ON f.origin_airport_id = oa.id
      LEFT JOIN airports da ON f.destination_airport_id = da.id
      ${where}
      ORDER BY t.code, g.code
    `, params);

    res.json(rows);
  } catch (err) { next(err); }
}

async function listTerminals(req, res, next) {
  try {
    const { airport_id } = req.query;
    let where = '';
    const params = [];
    if (airport_id) { where = 'WHERE airport_id = ?'; params.push(airport_id); }

    const [rows] = await db.query(
      `SELECT id, code, name, type, airport_id FROM terminals ${where} ORDER BY code`,
      params
    );
    res.json(rows);
  } catch (err) { next(err); }
}

async function assignFlight(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { gate_id } = req.params;
    const { flight_id, from_time, to_time, notes } = req.body;

    // Check for conflicting active assignment on this gate
    const [conflicts] = await db.query(`
      SELECT id FROM flight_gate_assignments
      WHERE gate_id = ? AND status IN ('planned','active')
        AND NOT (to_time <= ? OR from_time >= ?)
    `, [gate_id, from_time, to_time]);

    if (conflicts.length) {
      return res.status(409).json({ error: 'Gate already assigned during this time window' });
    }

    const [result] = await db.query(`
      INSERT INTO flight_gate_assignments (flight_id, gate_id, from_time, to_time, notes, status)
      VALUES (?, ?, ?, ?, ?, 'planned')
    `, [flight_id, gate_id, from_time, to_time, notes || null]);

    const [[assignment]] = await db.query(`
      SELECT fga.*, g.code AS gate_code, f.flight_number
      FROM flight_gate_assignments fga
      JOIN gates g ON fga.gate_id = g.id
      JOIN flights f ON fga.flight_id = f.id
      WHERE fga.id = ?
    `, [result.insertId]);

    req.app.get('io').to(`airport:${req.body.airport_id}`).emit('gate:assigned', assignment);
    res.status(201).json(assignment);
  } catch (err) { next(err); }
}

async function updateAssignment(req, res, next) {
  try {
    const { id } = req.params;
    const { status } = req.body;

    await db.query(
      'UPDATE flight_gate_assignments SET status = ? WHERE id = ?',
      [status, id]
    );

    const [[assignment]] = await db.query(`
      SELECT fga.*, g.code AS gate_code, t.airport_id,
             f.flight_number
      FROM flight_gate_assignments fga
      JOIN gates g ON fga.gate_id = g.id
      JOIN terminals t ON g.terminal_id = t.id
      JOIN flights f ON fga.flight_id = f.id
      WHERE fga.id = ?
    `, [id]);

    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

    req.app.get('io').to(`airport:${assignment.airport_id}`).emit('gate:updated', assignment);
    res.json(assignment);
  } catch (err) { next(err); }
}

module.exports = { listGates, listTerminals, assignFlight, updateAssignment };
