const db = require('../config/db');

async function listTracks(req, res, next) {
  try {
    const [rows] = await db.query(`
      SELECT ft.flight_id,
             f.flight_number,
             f.flight_type AS movement_type,
             MIN(ft.recorded_at) AS started_at,
             COUNT(*)            AS point_count
      FROM flight_tracks ft
      JOIN flights f ON ft.flight_id = f.id
      GROUP BY ft.flight_id, f.flight_number, f.flight_type
      ORDER BY started_at DESC
      LIMIT 50
    `);
    res.json(rows);
  } catch (err) { next(err); }
}

async function getTrack(req, res, next) {
  try {
    const flightId = parseInt(req.params.flightId, 10);
    const [rows] = await db.query(`
      SELECT ft.position_index,
             ft.lat, ft.lng, ft.heading,
             ft.altitude_ft, ft.ground_speed_kts, ft.phase,
             f.flight_number, f.flight_type AS movement_type
      FROM flight_tracks ft
      JOIN flights f ON ft.flight_id = f.id
      WHERE ft.flight_id = ?
      ORDER BY ft.position_index ASC
    `, [flightId]);

    if (!rows.length) return res.status(404).json({ error: 'No track data for this flight' });

    res.json({
      flight_id:     flightId,
      flight_number: rows[0].flight_number,
      movement_type: rows[0].movement_type,
      points: rows.map(r => ({
        position_index:   r.position_index,
        lat:              parseFloat(r.lat),
        lng:              parseFloat(r.lng),
        heading:          r.heading,
        altitude_ft:      r.altitude_ft,
        ground_speed_kts: r.ground_speed_kts,
        phase:            r.phase,
      })),
    });
  } catch (err) { next(err); }
}

module.exports = { listTracks, getTrack };
