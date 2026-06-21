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

    const [[stats]] = await db.query(
      `SELECT
        COUNT(*)                                        AS total_flights,
        SUM(status = 'departed')                        AS departed,
        SUM(status = 'arrived')                         AS arrived,
        SUM(status = 'delayed')                         AS delayed,
        SUM(status = 'cancelled')                       AS cancelled,
        SUM(status = 'boarding')                        AS boarding,
        SUM(status = 'scheduled')                       AS scheduled,
        ROUND(AVG(
          CASE WHEN actual_departure IS NOT NULL AND scheduled_departure IS NOT NULL
               THEN TIMESTAMPDIFF(MINUTE, scheduled_departure, actual_departure)
          END
        ), 1)                                           AS avg_departure_delay_min,
        ROUND(
          100.0 * SUM(
            CASE WHEN actual_departure <= DATE_ADD(scheduled_departure, INTERVAL 15 MINUTE)
                 AND actual_departure IS NOT NULL THEN 1 ELSE 0 END
          ) / NULLIF(SUM(status IN ('departed','arrived')), 0)
        , 1)                                            AS otp_percentage
       FROM flights ${where}`,
      params
    );

    res.json({ date, airport_id: airport_id || null, ...stats });
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

module.exports = { getLiveStats, getKpiSnapshots, getDelayTrends, getFlightEvents, getResourceUtilization };
