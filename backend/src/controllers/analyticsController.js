const db = require('../config/db');
const clickhouse = require('../config/clickhouse');

async function getLiveStats(req, res, next) {
  try {
    const { airport_id, date = new Date().toISOString().slice(0, 10) } = req.query;

    let where = 'WHERE DATE(scheduled_departure) = ?';
    const params = [date];
    if (airport_id) {
      where += ' AND (origin_airport_id = ? OR destination_airport_id = ?)';
      params.push(airport_id, airport_id);
    }

    const incidentWhere  = airport_id ? 'WHERE airport_id = ?' : '';
    const incidentParams = airport_id ? [airport_id] : [];

    const gateExtra  = airport_id ? 'AND t.airport_id = ?' : '';
    const gateParams = airport_id ? [airport_id] : [];

    const runwayExtra  = airport_id ? 'AND (origin_airport_id = ? OR destination_airport_id = ?)' : '';
    const runwayParams = airport_id ? [airport_id, airport_id] : [];

    const [statsRes, peakRes, incidentRes, gateRes, runwayRes] = await Promise.all([
      db.query(`
        SELECT
          COUNT(*)                                          AS total_flights,
          SUM(status = 'departed')                          AS \`departed\`,
          SUM(status = 'arrived')                           AS \`arrived\`,
          SUM(status = 'delayed')                           AS \`delayed\`,
          SUM(status = 'cancelled')                         AS \`cancelled\`,
          SUM(status = 'boarding')                          AS \`boarding\`,
          SUM(status = 'scheduled')                         AS \`scheduled\`,
          COALESCE(SUM(passenger_count), 0)                 AS total_passengers,
          ROUND(AVG(
            CASE WHEN actual_departure IS NOT NULL
                 THEN TIMESTAMPDIFF(MINUTE, scheduled_departure, actual_departure) END
          ), 1)                                             AS avg_departure_delay_min,
          ROUND(AVG(
            CASE WHEN actual_arrival IS NOT NULL AND scheduled_arrival IS NOT NULL
                 THEN TIMESTAMPDIFF(MINUTE, scheduled_arrival, actual_arrival) END
          ), 1)                                             AS avg_arrival_delay_min,
          ROUND(
            100.0 * SUM(CASE WHEN actual_departure <= DATE_ADD(scheduled_departure, INTERVAL 15 MINUTE)
                             AND actual_departure IS NOT NULL THEN 1 ELSE 0 END)
            / NULLIF(SUM(actual_departure IS NOT NULL), 0)
          , 1)                                              AS otp_percentage,
          ROUND(
            100.0 * SUM(CASE WHEN actual_departure <= DATE_ADD(scheduled_departure, INTERVAL 15 MINUTE)
                             AND actual_departure IS NOT NULL THEN 1 ELSE 0 END)
            / NULLIF(SUM(actual_departure IS NOT NULL), 0)
          , 1)                                              AS departure_otp_pct,
          ROUND(
            100.0 * SUM(CASE WHEN actual_arrival <= DATE_ADD(scheduled_arrival, INTERVAL 15 MINUTE)
                             AND actual_arrival IS NOT NULL THEN 1 ELSE 0 END)
            / NULLIF(SUM(actual_arrival IS NOT NULL), 0)
          , 1)                                              AS arrival_otp_pct
        FROM flights ${where}
      `, params),

      db.query(`
        SELECT COALESCE(MAX(cnt), 0) AS peak_hour_flights
        FROM (SELECT COUNT(*) AS cnt FROM flights ${where} GROUP BY HOUR(scheduled_departure)) sub
      `, params),

      db.query(`
        SELECT
          COALESCE(SUM(status IN ('open','in_progress')), 0)                           AS open_incidents,
          COALESCE(SUM(severity = 'critical' AND status IN ('open','in_progress')), 0)  AS critical_incidents
        FROM incidents ${incidentWhere}
      `, incidentParams),

      db.query(`
        SELECT
          COUNT(*) AS total_gates,
          COALESCE(SUM(fga.id IS NOT NULL), 0) AS occupied_gates
        FROM gates g
        JOIN terminals t ON g.terminal_id = t.id
        LEFT JOIN flight_gate_assignments fga
          ON g.id = fga.gate_id AND fga.status IN ('active','planned') AND fga.to_time >= NOW()
        WHERE g.status = 'active' ${gateExtra}
      `, gateParams),

      db.query(`
        SELECT COUNT(*) AS runway_movements_hr
        FROM flights
        WHERE DATE(scheduled_departure) = CURDATE()
          AND HOUR(scheduled_departure) = HOUR(NOW())
          ${runwayExtra}
      `, runwayParams),
    ]);

    const s        = statsRes[0][0];
    const gate     = gateRes[0][0];
    const gateUtil = gate?.total_gates > 0
      ? Math.round((Number(gate.occupied_gates) / Number(gate.total_gates)) * 100)
      : 0;

    const total     = Number(s?.total_flights || 0);
    const completed = Number(s?.departed || 0) + Number(s?.arrived || 0);
    const remaining = Number(s?.scheduled || 0) + Number(s?.boarding || 0) + Number(s?.delayed || 0);
    const completedPct = total > 0 ? Math.round((completed / total) * 100) : 0;

    res.json({
      date,
      airport_id: airport_id || null,
      ...s,
      peak_hour_flights:    Number(peakRes[0][0]?.peak_hour_flights    || 0),
      open_incidents:       Number(incidentRes[0][0]?.open_incidents    || 0),
      critical_incidents:   Number(incidentRes[0][0]?.critical_incidents || 0),
      gate_utilization_pct: gateUtil,
      completed_pct:        completedPct,
      remaining_flights:    remaining,
      runway_movements_hr:  Number(runwayRes[0][0]?.runway_movements_hr || 0),
    });
  } catch (err) {
    next(err);
  }
}

async function getAirportComparison(req, res, next) {
  try {
    const { date = new Date().toISOString().slice(0, 10) } = req.query;

    const [rows] = await db.query(`
      SELECT
        a.id          AS airport_id,
        a.iata_code,
        a.city,
        COUNT(f.id)                                              AS total_flights,
        COALESCE(SUM(f.status IN ('departed','arrived')), 0)    AS completed,
        COALESCE(SUM(f.status = 'delayed'), 0)                  AS \`delayed\`,
        COALESCE(SUM(f.status = 'cancelled'), 0)                AS cancelled,
        COALESCE(SUM(f.status = 'boarding'), 0)                 AS boarding,
        COALESCE(SUM(f.passenger_count), 0)                     AS total_passengers,
        ROUND(
          100.0 * SUM(CASE WHEN f.actual_departure <= DATE_ADD(f.scheduled_departure, INTERVAL 15 MINUTE)
                           AND f.actual_departure IS NOT NULL THEN 1 ELSE 0 END)
          / NULLIF(SUM(f.status IN ('departed','arrived')), 0)
        , 1)                                                     AS otp_pct
      FROM airports a
      LEFT JOIN flights f
        ON (f.origin_airport_id = a.id OR f.destination_airport_id = a.id)
        AND DATE(f.scheduled_departure) = ?
      WHERE a.id IN (1,2,3,4)
      GROUP BY a.id, a.iata_code, a.city
      ORDER BY a.id
    `, [date]);

    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function getKpiSnapshots(req, res, next) {
  try {
    const { airport_id, period_type = 'hourly', from, to, limit = 48 } = req.query;

    let where = 'period_type = {period_type:String}';
    const queryParams = { period_type };

    if (airport_id) {
      where += ' AND airport_id = {airport_id:UInt32}';
      queryParams.airport_id = parseInt(airport_id);
    }
    if (from) {
      where += ' AND snapshot_time >= {from:DateTime}';
      queryParams.from = from;
    }
    if (to) {
      where += ' AND snapshot_time <= {to:DateTime}';
      queryParams.to = to;
    }

    const result = await clickhouse.query({
      query: `SELECT * FROM kpi_snapshots WHERE ${where}
              ORDER BY snapshot_time DESC LIMIT {limit:UInt32}`,
      query_params: { ...queryParams, limit: parseInt(limit) },
      format: 'JSONEachRow',
    });

    res.json(await result.json());
  } catch (err) {
    next(err);
  }
}

async function getDelayTrends(req, res, next) {
  try {
    const { airport_id, airline_iata, from, to, group_by = 'day' } = req.query;

    let where = '1=1';
    const queryParams = {};

    if (airport_id) {
      where += ' AND airport_id = {airport_id:UInt32}';
      queryParams.airport_id = parseInt(airport_id);
    }
    if (airline_iata) {
      where += ' AND airline_iata = {airline_iata:String}';
      queryParams.airline_iata = airline_iata;
    }
    if (from) {
      where += ' AND event_time >= {from:DateTime}';
      queryParams.from = from;
    }
    if (to) {
      where += ' AND event_time <= {to:DateTime}';
      queryParams.to = to;
    }

    const truncFn = group_by === 'hour' ? 'toStartOfHour' : 'toStartOfDay';

    const result = await clickhouse.query({
      query: `SELECT
                ${truncFn}(event_time)        AS period,
                delay_cause_category,
                COUNT(*)                      AS flight_count,
                ROUND(AVG(delay_minutes), 1)  AS avg_delay_min,
                MAX(delay_minutes)            AS max_delay_min
              FROM delay_events
              WHERE ${where}
              GROUP BY period, delay_cause_category
              ORDER BY period DESC`,
      query_params: queryParams,
      format: 'JSONEachRow',
    });

    res.json(await result.json());
  } catch (err) {
    next(err);
  }
}

async function getFlightEvents(req, res, next) {
  try {
    const { flight_id, airport_id, event_type, from, to, limit = 100 } = req.query;

    let where = '1=1';
    const queryParams = {};

    if (flight_id) {
      where += ' AND flight_id = {flight_id:UInt64}';
      queryParams.flight_id = parseInt(flight_id);
    }
    if (airport_id) {
      where += ' AND airport_id = {airport_id:UInt32}';
      queryParams.airport_id = parseInt(airport_id);
    }
    if (event_type) {
      where += ' AND event_type = {event_type:String}';
      queryParams.event_type = event_type;
    }
    if (from) {
      where += ' AND event_time >= {from:DateTime}';
      queryParams.from = from;
    }
    if (to) {
      where += ' AND event_time <= {to:DateTime}';
      queryParams.to = to;
    }

    const result = await clickhouse.query({
      query: `SELECT * FROM flight_events WHERE ${where}
              ORDER BY event_time DESC LIMIT {limit:UInt32}`,
      query_params: { ...queryParams, limit: parseInt(limit) },
      format: 'JSONEachRow',
    });

    res.json(await result.json());
  } catch (err) {
    next(err);
  }
}

async function getResourceUtilization(req, res, next) {
  try {
    const { airport_id, resource_type, from, to } = req.query;

    let where = '1=1';
    const queryParams = {};

    if (airport_id) {
      where += ' AND airport_id = {airport_id:UInt32}';
      queryParams.airport_id = parseInt(airport_id);
    }
    if (resource_type) {
      where += ' AND resource_type = {resource_type:String}';
      queryParams.resource_type = resource_type;
    }
    if (from) {
      where += ' AND snapshot_time >= {from:DateTime}';
      queryParams.from = from;
    }
    if (to) {
      where += ' AND snapshot_time <= {to:DateTime}';
      queryParams.to = to;
    }

    const result = await clickhouse.query({
      query: `SELECT
                toStartOfHour(snapshot_time)             AS hour,
                resource_type,
                ROUND(AVG(utilization_pct), 1)           AS avg_utilization_pct,
                SUM(is_occupied)                         AS occupied_slots,
                COUNT(*)                                 AS total_slots
              FROM resource_utilization_snapshots
              WHERE ${where}
              GROUP BY hour, resource_type
              ORDER BY hour DESC
              LIMIT 168`,
      query_params: queryParams,
      format: 'JSONEachRow',
    });

    res.json(await result.json());
  } catch (err) {
    next(err);
  }
}

module.exports = {
  getLiveStats, getAirportComparison,
  getKpiSnapshots, getDelayTrends, getFlightEvents, getResourceUtilization,
};
