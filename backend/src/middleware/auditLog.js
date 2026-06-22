'use strict';
const db = require('../config/db');

function auditLog(action, entityType, getEntityId, getDescription) {
  return (req, res, next) => {
    const origJson = res.json.bind(res);
    res.json = function (body) {
      if (res.statusCode < 400 && req.user) {
        const userId   = req.user.sub || 'unknown';
        const username = req.user.preferred_username || req.user.name || userId;
        const entityId = typeof getEntityId === 'function'
          ? getEntityId(req, body)
          : (req.params[getEntityId] ?? null);
        const desc = typeof getDescription === 'function'
          ? getDescription(req, body)
          : (getDescription ?? null);

        db.query(
          'INSERT INTO audit_log (user_id, username, action, entity_type, entity_id, description, ip_address) VALUES (?,?,?,?,?,?,?)',
          [userId, username, action, entityType, entityId ? parseInt(entityId) : null, desc, req.ip]
        ).catch(e => console.error('[audit]', e.message));
      }
      return origJson(body);
    };
    next();
  };
}

module.exports = { auditLog };
