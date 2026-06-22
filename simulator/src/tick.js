'use strict';
const { pool } = require('./db');

const BACKEND_URL = process.env.BACKEND_INTERNAL_URL || 'http://backend.apoc.svc.cluster.local:3000';

function fmtUtc(d) { return d.toISOString().slice(0, 19).replace('T', ' '); }
function randMs(a, b) { return Math.floor(Math.random() * (b - a)) + a; }

async function broadcast(airportId, event, data) {
  try {
    await fetch(`${BACKEND_URL}/api/internal/broadcast`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ airport_id: airportId, event, data }),
      signal:  AbortSignal.timeout(2000),
    });
  } catch (_) { /* non-critical */ }
}

async function tick() {
  const db    = pool();
  const now   = new Date();
  const nowMs = now.getTime();

  const windowStart = fmtUtc(new Date(nowMs - 3 * 3_600_000));
  const windowEnd   = fmtUtc(new Date(nowMs + 4 * 3_600_000));

  const [flights] = await db.query(
    `SELECT id, flight_number, origin_airport_id, destination_airport_id,
            scheduled_departure, scheduled_arrival,
            estimated_departure, estimated_arrival,
            actual_departure, status
     FROM flights
     WHERE scheduled_departure BETWEEN ? AND ?
       AND status NOT IN ('arrived','cancelled','diverted')`,
    [windowStart, windowEnd],
  );

  let changed = 0;

  for (const f of flights) {
    const schDepMs = new Date(f.scheduled_departure).getTime();
    const schArrMs = new Date(f.scheduled_arrival).getTime();
    const estDepMs = f.estimated_departure ? new Date(f.estimated_departure).getTime() : schDepMs;
    const estArrMs = f.estimated_arrival   ? new Date(f.estimated_arrival).getTime()   : schArrMs;

    const effDepMs = Math.max(schDepMs, estDepMs);
    const effArrMs = Math.max(schArrMs, estArrMs);

    const minsToDep = (schDepMs - nowMs) / 60_000;

    let newStatus = f.status;
    let newEstDep = f.estimated_departure;
    let newEstArr = f.estimated_arrival;
    let newActDep = f.actual_departure;

    if (nowMs >= effArrMs + 10 * 60_000) {
      // Arrival time has passed
      newStatus = 'arrived';
      if (!newActDep) newActDep = fmtUtc(new Date(effDepMs + randMs(0, 120_000)));

    } else if (f.status === 'delayed' && nowMs >= effDepMs) {
      // Delayed flight now past its estimated departure
      newStatus = 'departed';
      if (!newActDep) newActDep = fmtUtc(new Date(effDepMs + randMs(0, 60_000)));

    } else if (f.status !== 'delayed' && nowMs >= schDepMs && minsToDep < -2) {
      // Past scheduled departure, not delayed → departed
      newStatus = 'departed';
      if (!newActDep) newActDep = fmtUtc(new Date(schDepMs + randMs(-60_000, 120_000)));

    } else if (f.status === 'scheduled' && minsToDep <= 45 && minsToDep > -2) {
      // Entering boarding window
      if (Math.random() < 0.12) {
        const delayMin = 20 + Math.floor(Math.random() * 70);
        newStatus = 'delayed';
        newEstDep = fmtUtc(new Date(schDepMs + delayMin * 60_000));
        newEstArr = fmtUtc(new Date(schArrMs + delayMin * 60_000));
      } else {
        newStatus = 'boarding';
      }
    }

    if (newStatus !== f.status || newActDep !== f.actual_departure) {
      await db.query(
        `UPDATE flights
         SET status=?, estimated_departure=?, estimated_arrival=?, actual_departure=?, updated_at=NOW()
         WHERE id=?`,
        [newStatus, newEstDep, newEstArr, newActDep, f.id],
      );

      const payload = {
        id:            f.id,
        flight_number: f.flight_number,
        status:        newStatus,
        estimated_departure: newEstDep,
        actual_departure:    newActDep,
      };

      // Emit to both origin and destination airport rooms
      await Promise.all([
        broadcast(f.origin_airport_id,      'flight:updated', payload),
        broadcast(f.destination_airport_id, 'flight:updated', payload),
      ]);

      changed++;
    }
  }

  if (changed > 0) console.log(`[tick] ${changed} flights updated`);
  return changed;
}

module.exports = { tick };
