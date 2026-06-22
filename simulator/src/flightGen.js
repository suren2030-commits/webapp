'use strict';
const {
  AIRPORTS, ROUTES_BY_ORIGIN, AIRLINE_IATA, AIRLINE_FN_BASE,
  MAX_PAX, HOUR_DIST, DELAY_CAUSES,
} = require('./data');

function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function pick(arr)      { return arr[rand(0, arr.length - 1)]; }
function fmtUtc(d)      { return d.toISOString().slice(0, 19).replace('T', ' '); }

// Exact integer distribution that sums to `total`, preserving hour shape
function distributeHours(total) {
  const raw     = HOUR_DIST.map(pct => total * pct / 100);
  const counts  = raw.map(Math.floor);
  const deficit = total - counts.reduce((s, v) => s + v, 0);
  // Give extra counts to hours with largest fractional parts
  raw.map((v, i) => ({ i, frac: v - Math.floor(v) }))
    .sort((a, b) => b.frac - a.frac)
    .slice(0, deficit)
    .forEach(({ i }) => counts[i]++);
  return counts;
}

/**
 * Generate all departure flights for every airport on `dayDate` (Date at 00:00 UTC).
 * `now` is used to determine statuses for today's flights.
 * Returns { flights: [...], delays: [...] }
 */
function generateFlightsForDay(dayDate, now) {
  const dayMs  = dayDate.getTime();
  const nowMs  = now.getTime();
  const flights = [];
  const delays  = [];

  for (const airport of AIRPORTS) {
    const routes = ROUTES_BY_ORIGIN[airport.id];
    if (!routes) continue;

    const hourCounts = distributeHours(airport.daily_dep);
    // Per-airline flight number counter for this day
    const fnCounters = { ...AIRLINE_FN_BASE };

    for (let h = 0; h < 24; h++) {
      for (let i = 0; i < hourCounts[h]; i++) {
        const [destId, durMin, airlineIds, acTypeIds] = pick(routes);
        const airlineId = pick(airlineIds);
        const acTypeId  = pick(acTypeIds);

        const flightNumber = `${AIRLINE_IATA[airlineId]}${fnCounters[airlineId]++}`;
        const depMin = rand(2, 57);
        const depMs  = dayMs + h * 3_600_000 + depMin * 60_000;
        const arrMs  = depMs + durMin * 60_000;
        const pax    = Math.round(MAX_PAX[acTypeId] * (0.65 + Math.random() * 0.30));

        const minsToDep = (depMs - nowMs) / 60_000;
        const minsToArr = (arrMs - nowMs) / 60_000;

        let status = 'scheduled';
        let estDep = null, estArr = null, actDep = null, actArr = null;
        let delayMin = 0, delayCause = null;

        if (minsToArr < -10) {
          // Fully in the past
          const r = Math.random();
          if (r < 0.04) {
            status = 'cancelled';
          } else if (r < 0.16) {
            // Delayed but eventually arrived
            delayMin   = rand(15, 90);
            delayCause = pick(DELAY_CAUSES);
            estDep = new Date(depMs + delayMin * 60_000);
            estArr = new Date(arrMs + delayMin * 60_000);
            actDep = new Date(depMs + delayMin * 60_000 + rand(0, 180_000));
            actArr = new Date(arrMs + delayMin * 60_000 + rand(0, 300_000));
            status = 'arrived';
          } else {
            // On-time arrival
            actDep = new Date(depMs + rand(-120_000, 120_000));
            actArr = new Date(arrMs + rand(-300_000, 300_000));
            status = 'arrived';
          }
        } else if (minsToDep < 0) {
          // Airborne (departed but not arrived)
          const r = Math.random();
          if (r < 0.08) {
            delayMin   = rand(20, 60);
            delayCause = pick(DELAY_CAUSES);
            estDep = new Date(depMs + delayMin * 60_000);
            estArr = new Date(arrMs + delayMin * 60_000);
            const effDep = estDep.getTime();
            if (nowMs >= effDep) {
              actDep = new Date(effDep + rand(0, 120_000));
              status = 'departed';
            } else {
              status = 'delayed';
            }
          } else {
            actDep = new Date(depMs + rand(-60_000, 120_000));
            status = 'departed';
          }
        } else if (minsToDep <= 45) {
          // Boarding window
          const r = Math.random();
          if (r < 0.15) {
            delayMin   = rand(20, 90);
            delayCause = pick(DELAY_CAUSES);
            estDep     = new Date(depMs + delayMin * 60_000);
            estArr     = new Date(arrMs + delayMin * 60_000);
            status     = 'delayed';
          } else {
            status = 'boarding';
          }
        } else {
          // Future scheduled — tiny pre-notified delay chance
          if (Math.random() < 0.02) {
            delayMin   = rand(30, 120);
            delayCause = pick(DELAY_CAUSES);
            estDep     = new Date(depMs + delayMin * 60_000);
            estArr     = new Date(arrMs + delayMin * 60_000);
            status     = 'delayed';
          }
        }

        flights.push({
          flight_number:          flightNumber,
          airline_id:             airlineId,
          aircraft_type_id:       acTypeId,
          origin_airport_id:      airport.id,
          destination_airport_id: destId,
          flight_type:            airport.id <= 4 ? 'departure' : 'arrival',
          scheduled_departure:    fmtUtc(new Date(depMs)),
          scheduled_arrival:      fmtUtc(new Date(arrMs)),
          estimated_departure:    estDep ? fmtUtc(estDep) : null,
          estimated_arrival:      estArr ? fmtUtc(estArr) : null,
          actual_departure:       actDep ? fmtUtc(actDep) : null,
          actual_arrival:         actArr ? fmtUtc(actArr) : null,
          status,
          passenger_count: pax,
        });

        if (delayMin > 0 && status !== 'scheduled') {
          delays.push({
            event_time:           fmtUtc(new Date(depMs)),
            flight_number:        flightNumber,
            airline_iata:         AIRLINE_IATA[airlineId],
            airport_id:           airport.id,
            delay_type:           'departure',
            delay_minutes:        delayMin,
            delay_cause_category: delayCause,
          });
        }
      }
    }
  }

  return { flights, delays };
}

module.exports = { generateFlightsForDay };
