const db = require('../config/db');
const { validationResult } = require('express-validator');

async function listIncidents(req, res, next) {
  try {
    const { airport_id, status, severity, page = 1, limit = 50 } = req.query;
    let where = 'WHERE 1=1';
    const params = [];

    if (airport_id) { where += ' AND i.airport_id = ?'; params.push(airport_id); }
    if (status)     { where += ' AND i.status = ?'; params.push(status); }
    if (severity)   { where += ' AND i.severity = ?'; params.push(severity); }

    const offset = (parseInt(page) - 1) * parseInt(limit);

    const [rows] = await db.query(`
      SELECT i.*, a.iata_code AS airport_iata, a.name AS airport_name,
             f.flight_number AS affected_flight_number
      FROM incidents i
      JOIN airports a ON i.airport_id = a.id
      LEFT JOIN flights f ON i.affected_flight_id = f.id
      ${where}
      ORDER BY
        FIELD(i.severity,'critical','high','medium','low'),
        FIELD(i.status,'open','in_progress','resolved','closed'),
        i.created_at DESC
      LIMIT ? OFFSET ?
    `, [...params, parseInt(limit), offset]);

    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM incidents i ${where}`, params
    );

    res.json({ data: rows, total, page: parseInt(page), limit: parseInt(limit) });
  } catch (err) { next(err); }
}

async function getIncident(req, res, next) {
  try {
    const [[incident]] = await db.query(`
      SELECT i.*, a.iata_code AS airport_iata, a.name AS airport_name,
             f.flight_number AS affected_flight_number
      FROM incidents i
      JOIN airports a ON i.airport_id = a.id
      LEFT JOIN flights f ON i.affected_flight_id = f.id
      WHERE i.id = ?
    `, [req.params.id]);

    if (!incident) return res.status(404).json({ error: 'Incident not found' });

    const [updates] = await db.query(`
      SELECT iu.*, s.full_name AS author_name
      FROM incident_updates iu
      LEFT JOIN staff s ON iu.updated_by = s.id
      WHERE iu.incident_id = ?
      ORDER BY iu.created_at ASC
    `, [req.params.id]);

    res.json({ ...incident, updates });
  } catch (err) { next(err); }
}

async function createIncident(req, res, next) {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  try {
    const { airport_id, title, description, type, severity, affected_flight_id } = req.body;

    const [result] = await db.query(`
      INSERT INTO incidents (airport_id, title, description, type, severity, status, affected_flight_id)
      VALUES (?, ?, ?, ?, ?, 'open', ?)
    `, [airport_id, title, description || null, type, severity, affected_flight_id || null]);

    const [[incident]] = await db.query(`
      SELECT i.*, a.iata_code AS airport_iata, a.name AS airport_name
      FROM incidents i JOIN airports a ON i.airport_id = a.id
      WHERE i.id = ?
    `, [result.insertId]);

    req.app.get('io').to(`airport:${airport_id}`).emit('incident:created', incident);
    res.status(201).json(incident);
  } catch (err) { next(err); }
}

async function updateIncident(req, res, next) {
  try {
    const { id } = req.params;
    const allowed = ['status', 'severity', 'title', 'description'];
    const fields = Object.keys(req.body).filter(k => allowed.includes(k));
    if (!fields.length) return res.status(400).json({ error: 'No updatable fields provided' });

    const values = fields.map(f => req.body[f]);

    // Set resolved_at when resolving
    if (req.body.status === 'resolved') {
      fields.push('resolved_at');
      values.push(new Date());
    }

    values.push(id);
    await db.query(
      `UPDATE incidents SET ${fields.map(f => `${f} = ?`).join(', ')} WHERE id = ?`,
      values
    );

    const [[incident]] = await db.query(`
      SELECT i.*, a.iata_code AS airport_iata, a.name AS airport_name
      FROM incidents i JOIN airports a ON i.airport_id = a.id
      WHERE i.id = ?
    `, [id]);

    if (!incident) return res.status(404).json({ error: 'Incident not found' });

    req.app.get('io').to(`airport:${incident.airport_id}`).emit('incident:updated', incident);
    res.json(incident);
  } catch (err) { next(err); }
}

async function addUpdate(req, res, next) {
  try {
    const { id } = req.params;
    const { update_text, staff_id = 1 } = req.body;

    if (!update_text?.trim()) return res.status(400).json({ error: 'update_text is required' });

    const [result] = await db.query(
      'INSERT INTO incident_updates (incident_id, update_text, updated_by) VALUES (?, ?, ?)',
      [id, update_text, staff_id]
    );

    const [[update]] = await db.query(
      `SELECT iu.*, s.full_name AS author_name
       FROM incident_updates iu LEFT JOIN staff s ON iu.updated_by = s.id
       WHERE iu.id = ?`,
      [result.insertId]
    );

    res.status(201).json(update);
  } catch (err) { next(err); }
}

async function getStats(req, res, next) {
  try {
    const { airport_id } = req.query;
    let where = '';
    const params = [];
    if (airport_id) { where = 'WHERE airport_id = ?'; params.push(airport_id); }

    const [[stats]] = await db.query(`
      SELECT
        SUM(status = 'open')                           AS open_count,
        SUM(status = 'in_progress')                    AS in_progress_count,
        SUM(severity = 'critical' AND status != 'closed' AND status != 'resolved') AS critical_count,
        SUM(status IN ('resolved','closed') AND DATE(resolved_at) = CURDATE()) AS resolved_today
      FROM incidents ${where}
    `, params);

    res.json(stats);
  } catch (err) { next(err); }
}

module.exports = { listIncidents, getIncident, createIncident, updateIncident, addUpdate, getStats };
