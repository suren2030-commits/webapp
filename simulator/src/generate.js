'use strict';
require('dotenv').config();
const { pool, ch } = require('./db');
const { generateFlightsForDay } = require('./flightGen');
const { buildDayKpis } = require('./kpi');

const DAYS_BACK  = parseInt(process.env.DAYS_BACK  || '29');
const DAYS_AHEAD = parseInt(process.env.DAYS_AHEAD || '2');
const BATCH      = 200;

const FLIGHT_COLS = `(flight_number, airline_id, aircraft_type_id,
  origin_airport_id, destination_airport_id, flight_type,
  scheduled_departure, scheduled_arrival,
  estimated_departure, estimated_arrival,
  actual_departure, actual_arrival,
  status, passenger_count)`;

async function insertFlights(db, flights) {
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

async function run() {
  console.log(`Generating ${DAYS_BACK + 1 + DAYS_AHEAD} days of flight data…`);
  const db      = pool();
  const chClient = ch();
  const now     = new Date();

  // ── Clear existing data ───────────────────────────────────────────────────
  console.log('Clearing existing data…');
  await db.query('SET FOREIGN_KEY_CHECKS = 0');
  for (const t of [
    'flight_ground_services', 'flight_carousel_assignments',
    'flight_checkin_assignments', 'flight_runway_assignments',
    'flight_stand_assignments', 'flight_gate_assignments', 'flights',
  ]) {
    await db.query(`TRUNCATE TABLE ${t}`);
    process.stdout.write('.');
  }
  await db.query('SET FOREIGN_KEY_CHECKS = 1');
  console.log('\nMySQL cleared.');

  await chClient.command({ query: 'TRUNCATE TABLE kpi_snapshots'  });
  await chClient.command({ query: 'TRUNCATE TABLE delay_events'   });
  await chClient.command({ query: 'TRUNCATE TABLE flight_events'  });
  console.log('ClickHouse cleared.');

  // ── Generate day by day ───────────────────────────────────────────────────
  const today = new Date(now);
  today.setUTCHours(0, 0, 0, 0);

  let totalFlights = 0;
  let totalDelays  = 0;

  for (let d = -DAYS_BACK; d <= DAYS_AHEAD; d++) {
    const day    = new Date(today.getTime() + d * 86_400_000);
    const dayStr = day.toISOString().slice(0, 10);

    const { flights, delays } = generateFlightsForDay(day, now);

    await insertFlights(db, flights);

    if (delays.length > 0) {
      await chClient.insert({
        table:  'delay_events',
        values: delays.map(d => ({
          event_time:           d.event_time,
          flight_id:            0,
          flight_number:        d.flight_number,
          airline_iata:         d.airline_iata,
          airport_id:           d.airport_id,
          delay_type:           d.delay_type,
          delay_minutes:        d.delay_minutes,
          delay_cause_code:     '',
          delay_cause_category: d.delay_cause_category,
        })),
        format: 'JSONEachRow',
      });
    }

    const kpiRows = buildDayKpis(day, flights);
    if (kpiRows.length > 0) {
      await chClient.insert({ table: 'kpi_snapshots', values: kpiRows, format: 'JSONEachRow' });
    }

    totalFlights += flights.length;
    totalDelays  += delays.length;
    console.log(`  ${dayStr}: ${flights.length} flights, ${delays.length} delays`);
  }

  console.log(`\nDone! ${totalFlights} flights, ${totalDelays} delay events.`);
  process.exit(0);
}

run().catch(err => { console.error('FATAL:', err); process.exit(1); });
