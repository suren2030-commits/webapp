const http = require('http');
const db   = require('../config/db');

// ── Accurate BOM (CSMIA Mumbai) coordinates from GeoServer shapefile ──────────
// Runway 09/27 centerline lat: 19.0887  (lng 72.8479–72.8807)
// RWY09 threshold = WEST end  (land heading 090°, approach from west)
// RWY27 threshold = EAST end  (land heading 270°, approach from east)
const RWY09_THR     = [19.08840, 72.84820]; // west threshold
const RWY27_THR     = [19.08840, 72.88050]; // east threshold
const RWY_MID       = [19.08840, 72.86430]; // mid-runway vacate zone

// Main parallel taxiway, just north of runway (~60 m north)
const TWY_N_WEST    = [19.08980, 72.85800]; // taxiway junction near C/A aprons
const TWY_N_CENTRAL = [19.08980, 72.86800]; // central taxiway junction
const TWY_N_EAST    = [19.09000, 72.87600]; // eastern taxiway junction near K/V

// Off-screen approach/departure fix points (along runway centreline lat)
const OFF_EAST      = [19.08840, 73.10000]; // east (Dubai/int'l approaches)
const OFF_WEST      = [19.08840, 72.61000]; // west

// ── Accurate apron centroid fallbacks (from GeoServer apron_bay query) ────────
const APRON_CENTER = {
  A: [19.091532, 72.853698],
  C: [19.091878, 72.859517],
  G: [19.095436, 72.867972],
  J: [19.081464, 72.872235],
  K: [19.096719, 72.879304],
  R: [19.092713, 72.874965],
  S: [19.092815, 72.868437],
  V: [19.095990, 72.874350],
};
const DEFAULT_APRON = [19.092000, 72.868000];

// ── Stand cache: populated from GeoServer on startup ─────────────────────────
const standCache = {}; // standCode → [lat, lng]

async function initStandCache() {
  return new Promise((resolve) => {
    const url =
      'http://geoserver.apoc.svc.cluster.local:8080/geoserver/bom/ows' +
      '?service=WFS&version=2.0.0&request=GetFeature' +
      '&typeName=bom:apron_bay&outputFormat=application/json&srsName=EPSG:4326';
    http.get(url, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try {
          const geojson = JSON.parse(d);
          geojson.features.forEach(f => {
            const sn = f.properties?.StandNo;
            if (!sn) return;
            const ring = f.geometry?.type === 'MultiPolygon'
              ? f.geometry.coordinates[0][0]
              : f.geometry?.coordinates?.[0];
            if (!ring || ring.length < 3) return;
            let sumLat = 0, sumLng = 0;
            ring.forEach(([lng, lat]) => { sumLat += lat; sumLng += lng; });
            standCache[String(sn)] = [+(sumLat / ring.length).toFixed(7), +(sumLng / ring.length).toFixed(7)];
          });
          console.log(`[movementSimulator] Stand cache loaded: ${Object.keys(standCache).length} stands`);
        } catch (e) {
          console.warn('[movementSimulator] Stand cache parse error:', e.message);
        }
        resolve();
      });
    }).on('error', () => {
      console.warn('[movementSimulator] GeoServer unreachable — using apron centroids');
      resolve();
    });
  });
}

// Initialise on module load
initStandCache();

// ── Math helpers ──────────────────────────────────────────────────────────────
function lerp(a, b, t) { return a + (b - a) * t; }

function bearingDeg(from, to) {
  const toR = d => d * Math.PI / 180;
  const [lat1, lng1] = from.map(toR);
  const [lat2, lng2] = to.map(toR);
  const dLng = lng2 - lng1;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return ((Math.atan2(y, x) * 180 / Math.PI) + 360) % 360;
}

function segment(from, to, steps, phase, altA, altB, spdA, spdB) {
  const hdg = Math.round(bearingDeg(from, to));
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push({
      lat:              +lerp(from[0], to[0], t).toFixed(7),
      lng:              +lerp(from[1], to[1], t).toFixed(7),
      heading:          hdg,
      altitude_ft:      Math.round(lerp(altA, altB, t)),
      ground_speed_kts: Math.round(lerp(spdA, spdB, t)),
      phase,
    });
  }
  return pts;
}

// ── Choose best TWY junction to reach a stand ────────────────────────────────
function twyForApron(letter) {
  if (['A', 'C'].includes(letter)) return TWY_N_WEST;
  if (['K', 'V'].includes(letter)) return TWY_N_EAST;
  return TWY_N_CENTRAL; // G, R, S, J, default
}

// ── Resolve stand or fall back to apron centroid ─────────────────────────────
function resolveStandPos(standCode) {
  if (standCode && standCache[standCode]) return standCache[standCode];
  if (standCode) {
    const letter = standCode[0].toUpperCase();
    return APRON_CENTER[letter] || DEFAULT_APRON;
  }
  return DEFAULT_APRON;
}

// ── Path builders ─────────────────────────────────────────────────────────────
function buildDeparturePath(standCode) {
  const stand     = resolveStandPos(standCode);
  const letter    = standCode ? standCode[0].toUpperCase() : null;
  const twy       = twyForApron(letter);
  const goEast    = Math.random() < 0.5; // which direction we depart
  const rwyStart  = goEast ? RWY09_THR : RWY27_THR;
  const rwyEnd    = goEast ? RWY27_THR : RWY09_THR;
  const offPt     = goEast ? OFF_EAST  : OFF_WEST;

  return [
    ...segment(stand,    twy,       10, 'taxi_out',  0,    0,   12,  22),
    ...segment(twy,      RWY_MID,    8, 'holding',   0,    0,   18,  18),
    ...segment(RWY_MID,  rwyStart,   6, 'lineup',    0,    0,   10,  10),
    ...segment(rwyStart, rwyEnd,    12, 'takeoff',   0,   80,   10, 155),
    ...segment(rwyEnd,   offPt,     24, 'climbing', 80, 9000,  155, 285),
  ];
}

function buildArrivalPath(standCode) {
  const stand    = resolveStandPos(standCode);
  const letter   = standCode ? standCode[0].toUpperCase() : null;
  const twy      = twyForApron(letter);
  const fromEast = Math.random() < 0.5;
  const offPt    = fromEast ? OFF_EAST  : OFF_WEST;
  const rwyEntry = fromEast ? RWY27_THR : RWY09_THR; // threshold you cross first
  const rwyExit  = fromEast ? RWY09_THR : RWY27_THR; // far end / vacate

  // Intermediate point: north of RWY_MID to exit the runway smoothly
  const vacatePt = [RWY_MID[0] + 0.0012, RWY_MID[1]]; // ~130 m north of mid

  return [
    ...segment(offPt,    rwyEntry,  24, 'approach',  9000, 200, 285, 155),
    ...segment(rwyEntry, RWY_MID,   10, 'touchdown',  200,  20, 155,  45),
    ...segment(RWY_MID,  vacatePt,   4, 'vacating',    20,   0,  45,  22),
    ...segment(vacatePt, twy,         8, 'taxi_in',      0,   0,  20,  15),
    ...segment(twy,      stand,      10, 'parking',      0,   0,  15,   0),
  ];
}

// ── Active movement map: flight_id → intervalId ───────────────────────────────
const activeMovements = new Map();

async function startMovement(io, flight_id, flight_number, movementType, standCode) {
  if (activeMovements.has(flight_id)) {
    clearInterval(activeMovements.get(flight_id));
    activeMovements.delete(flight_id);
  }

  const path = movementType === 'departure'
    ? buildDeparturePath(standCode)
    : buildArrivalPath(standCode);

  // Persist full track for playback
  try {
    await db.query('DELETE FROM flight_tracks WHERE flight_id = ?', [flight_id]);
    const placeholders = path.map(() => '(?,?,?,?,?,?,?,?)').join(',');
    const values = path.flatMap((pt, i) => [
      flight_id, i, pt.lat, pt.lng, pt.heading,
      pt.altitude_ft, pt.ground_speed_kts, pt.phase,
    ]);
    await db.query(
      `INSERT INTO flight_tracks
         (flight_id, position_index, lat, lng, heading, altitude_ft, ground_speed_kts, phase)
       VALUES ${placeholders}`,
      values
    );
  } catch (e) {
    console.error('[movementSimulator] DB insert error:', e.message);
  }

  let idx = 0;
  const TICK_MS = 2000;

  const timer = setInterval(() => {
    const isFinal = idx >= path.length - 1;
    const pt = path[Math.min(idx, path.length - 1)];

    io.to('airport:1').emit('flight:movement', {
      flight_id,
      flight_number,
      movement_type: movementType,
      position:       { ...pt },
      position_index: idx,
      total_points:   path.length,
      is_final:       isFinal,
    });

    if (isFinal) {
      clearInterval(timer);
      activeMovements.delete(flight_id);
    }
    idx++;
  }, TICK_MS);

  activeMovements.set(flight_id, timer);
}

module.exports = { startMovement };
