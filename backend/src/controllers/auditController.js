'use strict';
const db = require('../config/db');

async function getAuditLog(req, res, next) {
  try {
    const { entity_type, username, limit = 100, offset = 0 } = req.query;

    let where = '1=1';
    const params = [];
    if (entity_type) { where += ' AND entity_type = ?';   params.push(entity_type); }
    if (username)    { where += ' AND username LIKE ?';    params.push(`%${username}%`); }

    const [rows]  = await db.query(
      `SELECT * FROM audit_log WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(limit), parseInt(offset)]
    );
    const [[{ total }]] = await db.query(
      `SELECT COUNT(*) AS total FROM audit_log WHERE ${where}`, params
    );

    res.json({ data: rows, total });
  } catch (err) {
    next(err);
  }
}

module.exports = { getAuditLog };
