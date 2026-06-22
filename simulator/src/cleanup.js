'use strict';
require('dotenv').config();
const { pool, ch } = require('./db');

async function run() {
  const db       = pool();
  const chClient = ch();
  const cutoff   = 30; // days

  console.log(`Cleaning data older than ${cutoff} days…`);

  // Delete dependent rows before flights (no ON DELETE CASCADE in schema)
  const depTables = [
    'flight_ground_services', 'flight_carousel_assignments',
    'flight_checkin_assignments', 'flight_runway_assignments',
    'flight_stand_assignments', 'flight_gate_assignments',
  ];
  for (const t of depTables) {
    const [r] = await db.query(
      `DELETE d FROM ${t} d
       JOIN flights f ON d.flight_id = f.id
       WHERE f.scheduled_departure < DATE_SUB(NOW(), INTERVAL ? DAY)`,
      [cutoff],
    );
    if (r.affectedRows > 0) console.log(`  ${t}: removed ${r.affectedRows} rows`);
  }

  const [fr] = await db.query(
    `DELETE FROM flights WHERE scheduled_departure < DATE_SUB(NOW(), INTERVAL ? DAY)`,
    [cutoff],
  );
  console.log(`  flights: removed ${fr.affectedRows} rows`);

  // ClickHouse: tables have TTL defined, but also manually drop old kpi_snapshots
  await chClient.command({
    query: `ALTER TABLE kpi_snapshots DELETE WHERE snapshot_time < now() - INTERVAL ${cutoff} DAY`,
  });
  await chClient.command({
    query: `ALTER TABLE delay_events DELETE WHERE event_time < now() - INTERVAL ${cutoff} DAY`,
  });
  console.log('ClickHouse cleanup done (async mutation queued).');

  process.exit(0);
}

run().catch(err => { console.error('FATAL:', err); process.exit(1); });
