'use strict';

function fmtUtc(d) { return d.toISOString().slice(0, 19).replace('T', ' '); }
function rand(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }

const ALL_AIRPORT_IDS = [1, 2, 3, 4, 5, 6];

function computeSnapshot(snapshotTime, airportId, flights, periodType) {
  const total     = flights.length;
  const departed  = flights.filter(f => ['departed','arrived'].includes(f.status)).length;
  const arrived   = flights.filter(f => f.status === 'arrived').length;
  const delayed   = flights.filter(f =>
    f.status === 'delayed' || (f.estimated_departure && f.status !== 'cancelled')
  ).length;
  const cancelled = flights.filter(f => f.status === 'cancelled').length;

  const onTime = flights.filter(f => {
    if (!['departed','arrived'].includes(f.status)) return false;
    const actMs = f.actual_departure ? new Date(f.actual_departure).getTime() : null;
    const schMs = new Date(f.scheduled_departure).getTime();
    return actMs !== null && actMs <= schMs + 15 * 60_000;
  }).length;

  const otp = departed > 0 ? Math.round((onTime / departed) * 1000) / 10 : 0;

  const delayedWithActual = flights.filter(f => f.estimated_departure && f.actual_departure);
  const avgDepDelay = delayedWithActual.length > 0
    ? delayedWithActual.reduce((s, f) =>
        s + (new Date(f.actual_departure).getTime() - new Date(f.scheduled_departure).getTime()) / 60_000, 0
      ) / delayedWithActual.length
    : 0;

  return {
    snapshot_time:           fmtUtc(snapshotTime),
    airport_id:              airportId,
    period_type:             periodType,
    total_flights:           total,
    departed_flights:        departed,
    arrived_flights:         arrived,
    delayed_flights:         delayed,
    cancelled_flights:       cancelled,
    otp_percentage:          otp,
    avg_departure_delay_min: Math.round(Math.max(0, avgDepDelay) * 10) / 10,
    avg_arrival_delay_min:   0,
    avg_turnaround_min:      45 + rand(0, 30),
    gate_utilization_pct:    40 + rand(0, 50),
    runway_utilization_pct:  30 + rand(0, 40),
    open_incidents:          0,
    critical_incidents:      0,
  };
}

/**
 * Build all hourly + daily KPI rows for a full day.
 * @param {Date} dayDate  midnight UTC
 * @param {Array} allFlights  all flights generated for that day (all airports)
 */
function buildDayKpis(dayDate, allFlights) {
  const rows  = [];
  const dayMs = dayDate.getTime();

  for (const airportId of ALL_AIRPORT_IDS) {
    const aptFlights = allFlights.filter(f => f.origin_airport_id === airportId);

    // Hourly
    for (let h = 0; h < 24; h++) {
      const hStart = dayMs + h * 3_600_000;
      const hEnd   = hStart + 3_600_000;
      const hf     = aptFlights.filter(f => {
        const t = new Date(f.scheduled_departure).getTime();
        return t >= hStart && t < hEnd;
      });
      if (hf.length === 0) continue;
      rows.push(computeSnapshot(new Date(hStart), airportId, hf, 'hourly'));
    }

    // Daily
    if (aptFlights.length > 0) {
      rows.push(computeSnapshot(dayDate, airportId, aptFlights, 'daily'));
    }
  }

  return rows;
}

/**
 * Build a single hourly KPI snapshot for one airport from a MySQL result set.
 */
function buildHourKpi(hourDate, airportId, flights) {
  if (flights.length === 0) return null;
  return computeSnapshot(hourDate, airportId, flights, 'hourly');
}

module.exports = { buildDayKpis, buildHourKpi };
