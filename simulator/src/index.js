'use strict';
require('dotenv').config();
const { pool, ch }          = require('./db');
const { tick }              = require('./tick');
const { generateFlightsForDay } = require('./flightGen');
const { buildHourKpi, buildDayKpis } = require('./kpi');

const FLIGHT_COLS = `(flight_number, airline_id, aircraft_type_id,
  origin_airport_id, destination_airport_id, flight_type,
  scheduled_departure, scheduled_arrival,
  estimated_departure, estimated_arrival,
  actual_departure, actual_arrival,
  status, passenger_count)`;

async function insertFlights(db, flights) {
  const BATCH = 200;
  for (let i = 0; i < flights.length; i += BATCH) {
    const slice = flights.slice(i, i + BATCH);
    const ph    = slice.map(() => '(?,?,?,?,?,?,?,?,?,?,?,?,?,?)').join(',');
    const vals  = slice.flatMap(f => [
      f.flight_number, f.airline_id, f.aircraft_type_id,
      f.origin_airport_id, f.destination_airport_id, f.flight_type,
      f.scheduled_departure, f.scheduled_arrival,
      f.estimated_departure || null, f.estimated_arrival || null,
      f.actual_departure    || null, f.actual_arrival    || null,
      f.status, f.passenger_count,
    ]);
    await db.query(`INSERT INTO flights ${FLIGHT_COLS} VALUES ${ph}`, vals);
  }
}

async function ensureDayExists(db, dayDate, now) {
  const dateStr = dayDate.toISOString().slice(0, 10);
  const [[{ cnt }]] = await db.query(
    `SELECT COUNT(*) AS cnt FROM flights WHERE DATE(scheduled_departure) = ?`, [dateStr],
  );
  if (cnt === 0) {
    const { flights } = generateFlightsForDay(dayDate, now);
    await insertFlights(db, flights);
    console.log(`[startup] Generated ${flights.length} flights for ${dateStr}`);
  }
}

async function pushHourlyKpi(db, chClient, hourDate) {
  const hourEnd = new Date(hourDate.getTime() + 3_600_000);
  const hStart  = hourDate.toISOString().slice(0, 19).replace('T', ' ');
  const hEnd    = hourEnd.toISOString().slice(0, 19).replace('T', ' ');

  const kpiRows = [];
  for (const airportId of [1, 2, 3, 4, 5, 6]) {
    const [rows] = await db.query(
      `SELECT * FROM flights
       WHERE origin_airport_id = ?
         AND scheduled_departure >= ? AND scheduled_departure < ?`,
      [airportId, hStart, hEnd],
    );
    const snap = buildHourKpi(hourDate, airportId, rows);
    if (snap) kpiRows.push(snap);
  }

  if (kpiRows.length > 0) {
    await chClient.insert({ table: 'kpi_snapshots', values: kpiRows, format: 'JSONEachRow' });
    console.log(`[hourly] Pushed ${kpiRows.length} KPI snapshots for ${hStart}`);
  }
}

async function runDailyMaintenance(db, chClient, now) {
  // Ensure next 2 days have flights
  for (let d = 1; d <= 2; d++) {
    const day = new Date(now);
    day.setUTCDate(day.getUTCDate() + d);
    day.setUTCHours(0, 0, 0, 0);
    await ensureDayExists(db, day, now);
  }

  // Delete flights older than 30 days (simulator-generated, no assignments)
  const [r] = await db.query(
    `DELETE FROM flights WHERE scheduled_departure < DATE_SUB(NOW(), INTERVAL 30 DAY)`,
  );
  if (r.affectedRows > 0) console.log(`[cleanup] Removed ${r.affectedRows} old flights`);
}

async function main() {
  console.log('APOC Simulator starting…');
  const db       = pool();
  const chClient = ch();
  const now      = new Date();

  // On startup: ensure today + tomorrow + day-after have flights
  for (let d = 0; d <= 2; d++) {
    const day = new Date(now);
    day.setUTCDate(day.getUTCDate() + d);
    day.setUTCHours(0, 0, 0, 0);
    await ensureDayExists(db, day, now);
  }

  let lastHour = new Date().getUTCHours();
  let lastDay  = new Date().getUTCDate();

  console.log('Simulator running — tick every 60 s');

  setInterval(async () => {
    try {
      await tick();

      const t   = new Date();
      const hr  = t.getUTCHours();
      const day = t.getUTCDate();

      // Top-of-hour KPI push
      if (hr !== lastHour) {
        lastHour = hr;
        const prevHour = new Date(t);
        prevHour.setUTCMinutes(0, 0, 0);
        prevHour.setUTCHours(prevHour.getUTCHours() - 1);
        await pushHourlyKpi(db, chClient, prevHour);
      }

      // Midnight maintenance
      if (day !== lastDay) {
        lastDay = day;
        await runDailyMaintenance(db, chClient, t);
      }
    } catch (err) {
      console.error('[tick error]', err.message);
    }
  }, 60_000);
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
