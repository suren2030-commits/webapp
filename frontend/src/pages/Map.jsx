import { useState, useEffect, useCallback, useMemo, useRef, Fragment } from 'react';
import { Typography, Space, Spin, theme } from 'antd';
import { AimOutlined, ReloadOutlined, FullscreenOutlined, FullscreenExitOutlined } from '@ant-design/icons';
import { MapContainer, TileLayer, GeoJSON, Marker, Polyline, useMap, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import client from '../api/client';
import useAppStore from '../store/useAppStore';
import socket, { joinAirport, leaveAirport } from '../socket';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

const { Title, Text } = Typography;

const GEO_BASE = 'https://maps.airport.ops/geoserver/bom/ows';
const wfsUrl   = (layer) =>
  `${GEO_BASE}?service=WFS&version=2.0.0&request=GetFeature` +
  `&typeName=bom:${layer}&outputFormat=application/json&srsName=EPSG:4326`;

const AIRPORT_MAP = {
  1: { iata: 'BOM', name: 'CSMIA — Mumbai',      center: [19.0896, 72.8656], zoom: 14 },
  2: { iata: 'AMD', name: 'SVPI — Ahmedabad',     center: [23.0771, 72.6347], zoom: 14 },
};

// ── Layer definitions (rendered bottom → top) ─────────────────────────────────
const LAYER_DEFS = [
  // BASE
  { id: 'airport_land',    title: 'Airport Land',          cat: 'Base',
    style: { fillColor:'#141b26', color:'#1e2b3d', weight:0.5, fillOpacity:1 },
    defaultOn: true,  minZoom: 0 },
  { id: 'airside_surfaces', title: 'Airside Surfaces',     cat: 'Base',
    style: { fillColor:'#141f1c', color:'#1c2c24', weight:0.3, fillOpacity:1 },
    defaultOn: true,  minZoom: 0 },

  // ROADS (rendered under runway)
  { id: 'external_roads',  title: 'External Roads',        cat: 'Roads',
    style: { fillColor:'#1a2030', color:'#28303e', weight:0.5, fillOpacity:1 },
    defaultOn: true,  minZoom: 0 },
  { id: 'elevated_road',   title: 'Elevated Road',         cat: 'Roads',
    style: { fillColor:'#252e42', color:'#3e4e64', weight:1,   fillOpacity:0.9 },
    defaultOn: true,  minZoom: 0 },

  // MOVEMENT AREA
  { id: 'runway_shoulder', title: 'Runway Shoulder',       cat: 'Movement',
    style: { fillColor:'#1c2838', color:'#28384e', weight:0.5, fillOpacity:1 },
    defaultOn: true,  minZoom: 0 },
  { id: 'runway',          title: 'Runways',               cat: 'Movement',
    style: { fillColor:'#2e3c4e', color:'#4a5e72', weight:1,   fillOpacity:1 },
    defaultOn: true,  minZoom: 0,
    label: {
      fn: p => { const v = p?.Name; return v?.length === 4 ? `RWY ${v.slice(0,2)}/${v.slice(2)}` : (v || null); },
      minZoom: 13, cls: 'apoc-lbl lbl-runway',
    },
  },
  { id: 'taxiway_shoulder',title: 'Taxiway Shoulder',      cat: 'Movement',
    style: { fillColor:'#182028', color:'#222e3a', weight:0.5, fillOpacity:1 },
    defaultOn: true,  minZoom: 0 },
  { id: 'taxiway',         title: 'Taxiways',              cat: 'Movement',
    style: { fillColor:'#1e2e3e', color:'#2e4256', weight:0.5, fillOpacity:1 },
    defaultOn: true,  minZoom: 0,
    label: {
      fn: p => p?.TWY_ID || null,
      minZoom: 15, cls: 'apoc-lbl lbl-taxiway',
    },
  },
  { id: 'holding_points',  title: 'Holding Points',        cat: 'Movement',
    style: { fillColor:'#5a3800', color:'#e69500', weight:1.5, fillOpacity:0.85 },
    defaultOn: true,  minZoom: 0,
    label: {
      fn: p => {
        const t = (p?.TWY  || '').replace('TWY ', '');
        const r = (p?.forRWY || '').replace('RWY ', '');
        return t && r ? `${t}/${r}` : (t || null);
      },
      minZoom: 15, cls: 'apoc-lbl lbl-holding',
    },
  },

  // MARKINGS (above pavement)
  { id: 'runway_markings', title: 'Runway Markings',       cat: 'Markings',
    style: { color:'#e0c824', weight:1,   fill:false, opacity:0.85 },
    defaultOn: true,  minZoom: 0 },
  { id: 'taxiway_cl',      title: 'Taxiway Centrelines',   cat: 'Markings',
    style: { color:'#c8a830', weight:0.8, fill:false, opacity:0.75, dashArray:'5 5' },
    defaultOn: false, minZoom: 0 },

  // APRON
  { id: 'apron',           title: 'Apron Zones',           cat: 'Apron',
    style: { fillColor:'#192430', color:'#243548', weight:0.5, fillOpacity:1 },
    defaultOn: true,  minZoom: 0,
    label: {
      fn: p => p?.Apron ? `APRON ${p.Apron}` : null,
      minZoom: 14, cls: 'apoc-lbl lbl-apron',
    },
  },
  { id: 'stand_lines',     title: 'Stand Lead-in Lines',   cat: 'Apron',
    style: { color:'#b88a18', weight:1, fill:false, opacity:0.7 },
    defaultOn: true,  minZoom: 15 },
  // apron_bay rendered separately with live status — NOT in this array

  // BUILDINGS
  { id: 'buildings',       title: 'Other Buildings',       cat: 'Buildings',
    style: { fillColor:'#1a1e2d', color:'#262c3e', weight:0.5, fillOpacity:1 },
    defaultOn: true,  minZoom: 14 },
  { id: 'terminal',        title: 'Terminals',             cat: 'Buildings',
    style: { fillColor:'#0c1e3a', color:'#2b6cb0', weight:1.5, fillOpacity:0.95 },
    defaultOn: true,  minZoom: 0,
    label: {
      fn: p => {
        // Only label passenger terminals (Category 9) using the short TAG field
        const cat = p?.Category;
        if (cat !== '9' && cat !== 9) return null;
        const tag = p?.TAG;
        if (!tag) return null;
        if (tag === 'T2 Main') return 'T2';
        if (tag === 'BG')      return 'BRD GATES';
        if (tag === 'CA T')    return 'CA TERM';
        return tag; // T1-A, T1-B, T1-C
      },
      minZoom: 13, cls: 'apoc-lbl lbl-terminal',
    },
  },
  { id: 'safe_assembly_points', title: 'Safe Assembly Points', cat: 'Buildings',
    style: null,
    pointToLayer: (_, latlng) => L.circleMarker(latlng, {
      radius: 5, fillColor: '#f6a000', color: '#e07800', weight: 1.5, fillOpacity: 0.9,
    }),
    defaultOn: true,  minZoom: 0,
    label: {
      fn: () => 'SAP',
      minZoom: 15, cls: 'apoc-lbl lbl-sap',
    },
  },

  // INTERNAL ROADS (above buildings)
  { id: 'internal_roads',  title: 'Internal Roads',        cat: 'Roads',
    style: { fillColor:'#1e2838', color:'#303e50', weight:0.5, fillOpacity:1 },
    defaultOn: true,  minZoom: 0 },

  // BOUNDARY (always on top)
  { id: 'boundary',        title: 'Airside Boundary',      cat: 'Base',
    style: { color:'#e09030', weight:2, dashArray:'8 4', fill:false, opacity:0.9 },
    defaultOn: true,  minZoom: 0 },
];

// Category display order & accent colours
const CATEGORIES = [
  { name: 'Base',      color: '#718096' },
  { name: 'Movement',  color: '#4a90d9' },
  { name: 'Apron',     color: '#48bb78' },
  { name: 'Buildings', color: '#63b3ed' },
  { name: 'Roads',     color: '#a0aec0' },
  { name: 'Markings',  color: '#d4a017' },
];

// ── Aircraft SVG factory ──────────────────────────────────────────────────────
function buildAircraftSVG(color, asw, ash, glow, strk, intk) {
  return `<svg viewBox="-15 -21 30 42" width="${asw}" height="${ash}"
     xmlns="http://www.w3.org/2000/svg"
     style="overflow:visible;filter:drop-shadow(0 0 ${glow}px ${color})drop-shadow(0 0 ${glow * 2}px ${color}88)">
  <g fill="${color}" stroke="${strk}" stroke-width="1.4" stroke-linejoin="round">
    <path d="M 0,-20 C 1,-16 2.5,-12 2.5,-7 L 2.5,9 C 2.5,14 1.2,17 0,18.5 C -1.2,17 -2.5,14 -2.5,9 L -2.5,-7 C -2.5,-12 -1,-16 0,-20 Z"/>
    <path d="M 2.5,0 L 13.5,7 L 13,10.5 L 2.5,7.5 Z"/>
    <path d="M -2.5,0 L -13.5,7 L -13,10.5 L -2.5,7.5 Z"/>
    <ellipse cx="9.5"  cy="7.5" rx="2.3" ry="0.85"/>
    <ellipse cx="-9.5" cy="7.5" rx="2.3" ry="0.85"/>
    <path d="M  2,13.5 L  7,17 L  6.7,18 L  2,15.5 Z"/>
    <path d="M -2,13.5 L -7,17 L -6.7,18 L -2,15.5 Z"/>
  </g>
  <ellipse cx="9.5"  cy="7.1" rx="1.1" ry="0.4" fill="${intk}" stroke="none"/>
  <ellipse cx="-9.5" cy="7.1" rx="1.1" ry="0.4" fill="${intk}" stroke="none"/>
</svg>`;
}

// ── Stand (apron_bay) live-status style ───────────────────────────────────────
function standStyle(gate) {
  if (!gate)                          return { fillColor:'#202830', color:'#3a4850', fillOpacity:0.75, weight:0.5 };
  if (gate.status === 'maintenance')  return { fillColor:'#4a1a1a', color:'#c53030', fillOpacity:0.9,  weight:1   };
  if (gate.flight_id)                 return { fillColor:'#1a2e4a', color:'#3a7dd4', fillOpacity:0.9,  weight:1   };
  return                                     { fillColor:'#1a3d28', color:'#38a169', fillOpacity:0.8,  weight:0.5 };
}

// ── Inner Leaflet helpers ─────────────────────────────────────────────────────
function ZoomTracker({ onChange }) {
  const initZoom = useMap().getZoom();
  useEffect(() => { onChange(initZoom); }, []); // eslint-disable-line
  useMapEvents({ zoomend: e => onChange(e.target.getZoom()) });
  return null;
}

function MapCenterUpdater({ center, zoom }) {
  const map = useMap();
  useEffect(() => { map.setView(center, zoom); }, [center, zoom, map]);
  return null;
}

function StatPill({ label, value, color }) {
  return (
    <div style={{
      display:'flex', flexDirection:'column', alignItems:'center',
      background:'rgba(0,0,0,0.72)', border:`1px solid ${color}38`,
      borderRadius:8, padding:'6px 14px', minWidth:70,
    }}>
      <span style={{ fontSize:17, fontWeight:800, color, fontFamily:'monospace' }}>{value}</span>
      <span style={{ fontSize:10, color:'rgba(255,255,255,0.4)', letterSpacing:0.8 }}>{label}</span>
    </div>
  );
}

const pbBtnStyle = {
  background:'rgba(255,255,255,0.06)', border:'1px solid rgba(255,255,255,0.12)',
  borderRadius:6, padding:'4px 9px', cursor:'pointer', color:'rgba(255,255,255,0.6)',
  fontSize:13, lineHeight:1,
};

// ── Main component ────────────────────────────────────────────────────────────
export default function TacticalMap() {
  const { airportId } = useAppStore();
  const { token }     = theme.useToken();

  const [layers,      setLayers]      = useState({});
  const [gateMap,     setGateMap]     = useState({});
  const [loading,     setLoading]     = useState(true);
  const [geoError,    setGeoError]    = useState(false);
  const [lastRefresh, setLastRefresh] = useState(null);
  const [zoom,        setZoom]        = useState(14);
  const [panelOpen,   setPanelOpen]   = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const mapWrapperRef = useRef(null);

  // ── Flight movement state ───────────────────────────────────────────────────
  const [liveMovements,   setLiveMovements]   = useState({});
  const [completedTracks, setCompletedTracks] = useState([]);
  const [tracksOpen,      setTracksOpen]      = useState(false);
  const [trackList,       setTrackList]       = useState([]);
  const [playback,        setPlayback]        = useState(null);
  const playbackTimerRef = useRef(null);

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      mapWrapperRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const [vis, setVis] = useState(() => ({
    ...Object.fromEntries(LAYER_DEFS.map(d => [d.id, d.defaultOn])),
    apron_bay: true,
  }));

  const effectiveAirportId = airportId || 1;
  const airport = AIRPORT_MAP[effectiveAirportId] || AIRPORT_MAP[1];

  // ── Load WFS layers ─────────────────────────────────────────────────────────
  useEffect(() => {
    setLoading(true);
    setGeoError(false);
    setLayers({});

    const names = [...LAYER_DEFS.map(d => d.id), 'apron_bay'];
    Promise.allSettled(
      names.map(name =>
        fetch(wfsUrl(name))
          .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
          .then(data => ({ name, data }))
      )
    ).then(results => {
      const loaded = {};
      let anyOk = false;
      results.forEach(r => {
        if (r.status === 'fulfilled' && r.value.data?.features?.length > 0) {
          loaded[r.value.name] = r.value.data;
          anyOk = true;
        }
      });
      setLayers(loaded);
      if (!anyOk) setGeoError(true);
      setLoading(false);
    });
  }, [effectiveAirportId]);

  // ── Gate status (every 60 s) ────────────────────────────────────────────────
  const fetchGates = useCallback(async () => {
    try {
      const { data } = await client.get('/api/gates', { params: { airport_id: effectiveAirportId } });
      const m = {};
      data.forEach(g => { m[g.code] = g; });
      setGateMap(m);
      setLastRefresh(new Date());
    } catch (_) {}
  }, [effectiveAirportId]);

  useEffect(() => {
    fetchGates();
    const id = setInterval(fetchGates, 60_000);
    return () => clearInterval(id);
  }, [fetchGates]);

  // ── Socket: join airport room + listen for flight movements ─────────────────
  useEffect(() => {
    joinAirport(effectiveAirportId);

    const handleMovement = ({ flight_id, flight_number, movement_type, position, is_final }) => {
      const fid = String(flight_id);
      if (is_final) {
        setLiveMovements(prev => {
          const existing = prev[fid];
          if (existing) {
            const finalPositions = [...existing.positions, position];
            setCompletedTracks(t => [
              ...t.filter(tr => tr.flight_id !== flight_id).slice(-19),
              { flight_id, flight_number, movement_type, positions: finalPositions },
            ]);
          }
          const { [fid]: _, ...rest } = prev;
          return rest;
        });
      } else {
        setLiveMovements(prev => ({
          ...prev,
          [fid]: {
            flight_number,
            movement_type,
            positions: [...(prev[fid]?.positions || []), position],
            phase: position.phase,
          },
        }));
      }
    };

    socket.on('flight:movement', handleMovement);
    return () => {
      socket.off('flight:movement', handleMovement);
      leaveAirport(effectiveAirportId);
    };
  }, [effectiveAirportId]);

  // ── Fetch track list when panel opens ─────────────────────────────────────
  useEffect(() => {
    if (!tracksOpen) return;
    client.get('/api/movements').then(r => setTrackList(r.data)).catch(() => {});
  }, [tracksOpen]);

  // ── Playback timer ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (playbackTimerRef.current) clearInterval(playbackTimerRef.current);
    if (!playback?.playing) return;
    const tickMs = Math.round(2000 / (playback.speed || 1));
    playbackTimerRef.current = setInterval(() => {
      setPlayback(pb => {
        if (!pb?.playing) return pb;
        const next = pb.idx + 1;
        if (next >= pb.track.length) return { ...pb, idx: pb.track.length - 1, playing: false };
        return { ...pb, idx: next };
      });
    }, tickMs);
    return () => clearInterval(playbackTimerRef.current);
  }, [playback?.playing, playback?.speed]);

  const loadTrackForPlayback = useCallback(async (flight_id, flight_number, movement_type) => {
    try {
      const { data } = await client.get(`/api/movements/${flight_id}`);
      setPlayback({
        flight_id,
        flight_number:  data.flight_number || flight_number,
        movement_type:  data.movement_type || movement_type,
        track:          data.points,
        idx:            0,
        speed:          1,
        playing:        false,
      });
      setTracksOpen(false);
    } catch (e) { console.error('Failed to load track:', e); }
  }, []);

  const gates       = Object.values(gateMap);
  const occupied    = gates.filter(g => g.flight_id).length;
  const maintenance = gates.filter(g => g.status === 'maintenance').length;
  const available   = gates.filter(g => !g.flight_id && g.status !== 'maintenance').length;

  // ── Stand layer handlers ────────────────────────────────────────────────────
  const getStandStyle = useCallback(f =>
    standStyle(gateMap[f?.properties?.StandNo]), [gateMap]);

  const onEachStand = useCallback((feature, layer) => {
    const id   = feature?.properties?.StandNo;
    const name = feature?.properties?.Name || id || '?';
    const gate = gateMap[id];

    const fs = gate?.flight_status;
    const timing =
      fs === 'delayed'   ? { label: 'DELAYED',      col: '#ff3b3b' } :
      fs === 'boarding'  ? { label: 'ON TIME',       col: '#22c55e' } :
      fs === 'scheduled' ? { label: 'EARLY ARR',     col: '#60a5fa' } :
      fs === 'arrived'   ? { label: 'PARKED / IDLE', col: '#94a3b8' } :
                           null;

    const col = gate?.status === 'maintenance' ? '#e53e3e'
      : gate?.flight_id ? '#4a90d9'
      : '#48bb78';

    const html = gate?.flight_number
      ? `<div style="font-family:monospace;padding:4px 2px;min-width:140px">
           <div style="font-size:13px;font-weight:700;color:${col};margin-bottom:4px">${name}</div>
           ${timing ? `<div style="font-size:10px;font-weight:700;color:${timing.col};letter-spacing:1px;margin-bottom:4px">${timing.label}</div>` : ''}
           <div style="font-size:11px;line-height:1.8">
             <b>${gate.flight_number}</b> · ${gate.airline_iata || ''}<br/>
             <span style="color:#718096">${gate.origin_iata||''} → ${gate.dest_iata||''}</span>
           </div>
         </div>`
      : `<div style="font-family:monospace;padding:4px 2px">
           <div style="font-size:13px;font-weight:700;color:${col};margin-bottom:4px">${name}</div>
           <div style="font-size:11px;color:${col}">
             ${gate?.status === 'maintenance' ? 'MAINTENANCE' : gate ? 'Available' : 'Unknown'}
           </div>
         </div>`;

    layer.bindPopup(html, { maxWidth: 220 });
    layer.on('mouseover', function() { this.setStyle({ weight:2, color:'#ffffff' }); });
    layer.on('mouseout',  function() { this.setStyle(getStandStyle(feature)); });
  }, [gateMap, getStandStyle]);

  // ── Layer panel helpers ─────────────────────────────────────────────────────
  const toggleCat = useCallback(cat => {
    const ids = LAYER_DEFS.filter(d => d.cat === cat).map(d => d.id);
    if (cat === 'Apron') ids.push('apron_bay');
    const allOn = ids.every(id => vis[id]);
    setVis(v => Object.fromEntries([...Object.entries(v), ...ids.map(id => [id, !allOn])]));
  }, [vis]);

  const byCategory = useMemo(() => {
    const m = {};
    LAYER_DEFS.forEach(d => { (m[d.cat] = m[d.cat] || []).push(d); });
    return m;
  }, []);

  // ── Stand centroids (from apron_bay polygons) + exact bearings (from stand_lines) ──
  const standPositions = useMemo(() => {
    if (!layers.apron_bay) return {};

    // Build StandNo → bearing from stand_lines (has exact parking heading per stand)
    const bearingMap = {};
    if (layers.stand_lines) {
      layers.stand_lines.features.forEach(f => {
        const sn = f.properties?.StandNo;
        const b  = f.properties?.Bearing;
        if (sn != null && b != null) bearingMap[sn] = Number(b);
      });
    }

    const pos = {};
    layers.apron_bay.features.forEach(f => {
      const standNo = f.properties?.StandNo;
      if (!standNo) return;
      const ring = f.geometry?.type === 'MultiPolygon'
        ? f.geometry.coordinates[0][0]
        : f.geometry?.coordinates?.[0];
      if (!ring || ring.length < 3) return;
      let sumLng = 0, sumLat = 0;
      ring.forEach(([lng, lat]) => { sumLng += lng; sumLat += lat; });
      const n = ring.length;
      pos[standNo] = {
        latlng:  [sumLat / n, sumLng / n],
        bearing: bearingMap[standNo] ?? 0,
      };
    });
    return pos;
  }, [layers.apron_bay, layers.stand_lines]);

  // ── Legend items ────────────────────────────────────────────────────────────
  const LEGEND = [
    { color:'#4a5e72', label:'Runway',               fill:true  },
    { color:'#2e4256', label:'Taxiway',              fill:true  },
    { color:'#243548', label:'Apron',                fill:true  },
    { color:'#2b6cb0', label:'Terminal',             fill:false },
    { color:'#e69500', label:'Holding Point',        fill:false },
    { color:'#38a169', label:'Stand — Available',    fill:true  },
    { color:'#3a7dd4', label:'Stand — Occupied',     fill:true  },
    { color:'#c53030', label:'Stand — Maintenance',  fill:true  },
    { color:'#22c55e', label:'Aircraft — On Time',   fill:true, aircraft:true },
    { color:'#ff4444', label:'Aircraft — Delayed',   fill:true, aircraft:true },
    { color:'#1d4ed8', label:'Aircraft — Early',     fill:true, aircraft:true },
    { color:'#dde6f5', label:'Aircraft — Idle',      fill:true, aircraft:true },
    { color:'#f6a000', label:'Safe Assembly Point',  fill:true  },
  ];

  return (
    <div style={{ position:'relative' }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <Space align="center" size={10}>
          <AimOutlined style={{ fontSize:20, color:token.colorPrimary }} />
          <Title level={3} style={{ margin:0 }}>Tactical Map</Title>
          <Text type="secondary" style={{ fontSize:12 }}>
            {airport.iata} · {airport.name}
          </Text>
        </Space>
        <Space size={8}>
          {lastRefresh && (
            <Text type="secondary" style={{ fontSize:11 }}>
              Gates {lastRefresh.toLocaleTimeString()}
            </Text>
          )}
          <div onClick={fetchGates} style={{
            cursor:'pointer', display:'flex', alignItems:'center', gap:4,
            background:token.colorBgLayout, border:`1px solid ${token.colorBorderSecondary}`,
            borderRadius:8, padding:'4px 10px', fontSize:12,
          }}>
            <ReloadOutlined style={{ fontSize:12 }} />
            <span>Refresh</span>
          </div>
        </Space>
      </div>

      {/* Map wrapper */}
      <div ref={mapWrapperRef} style={{
        height: isFullscreen ? '100vh' : 'calc(100vh - 140px)', minHeight:500,
        borderRadius: isFullscreen ? 0 : 12, overflow:'hidden',
        border:`1px solid ${token.colorBorderSecondary}`, position:'relative',
        background: '#0d1117',
      }}>

        {/* Loading */}
        {loading && (
          <div style={{
            position:'absolute', inset:0, zIndex:1000,
            display:'flex', alignItems:'center', justifyContent:'center',
            background:'rgba(10,15,30,0.85)',
          }}>
            <Spin size="large" tip="Loading airport layers…" />
          </div>
        )}

        {/* Error */}
        {geoError && !loading && (
          <div style={{
            position:'absolute', inset:0, zIndex:1000,
            display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center',
            background:'#0a0f1e', gap:12,
          }}>
            <AimOutlined style={{ fontSize:40, color:'#4a5568' }} />
            <Text style={{ color:'#a0aec0', fontSize:15 }}>Airport layers not available</Text>
            <Text type="secondary" style={{ fontSize:12, textAlign:'center', maxWidth:340 }}>
              Copy BOM shapefiles to <code>geoserver/data/bom/</code>,<br />
              build and deploy the GeoServer service, then reload.
            </Text>
          </div>
        )}

        {/* Leaflet map */}
        <MapContainer
          center={airport.center}
          zoom={airport.zoom}
          style={{ height:'100%', width:'100%', background:'#0d1117' }}
          zoomControl
          attributionControl={false}
        >
          <ZoomTracker onChange={setZoom} />
          <MapCenterUpdater center={airport.center} zoom={airport.zoom} />

          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            maxZoom={22}
          />

          {/* All defined layers in render order */}
          {LAYER_DEFS.map(def => {
            if (!vis[def.id] || !layers[def.id] || zoom < def.minZoom) return null;
            return (
              <Fragment key={def.id}>
                {/* Geometry */}
                <GeoJSON
                  key={`${def.id}-g`}
                  data={layers[def.id]}
                  style={def.style}
                  pointToLayer={def.pointToLayer}
                />
                {/* Labels — invisible geometry with permanent tooltips */}
                {def.label && zoom >= def.label.minZoom && (
                  <GeoJSON
                    key={`${def.id}-l`}
                    data={layers[def.id]}
                    style={() => ({ opacity:0, fillOpacity:0, weight:0 })}
                    pointToLayer={(_, latlng) =>
                      L.circleMarker(latlng, { radius:0, opacity:0, fillOpacity:0 })
                    }
                    onEachFeature={(feature, layer) => {
                      const text = def.label.fn(feature.properties);
                      if (text) layer.bindTooltip(text, {
                        permanent:  true,
                        direction:  'center',
                        className:  def.label.cls || 'apoc-lbl',
                      });
                    }}
                  />
                )}
              </Fragment>
            );
          })}

          {/* Stands — live status colours */}
          {vis.apron_bay && layers.apron_bay && (
            <Fragment key="apron_bay">
              <GeoJSON
                key={`stands-g-${occupied}-${maintenance}`}
                data={layers.apron_bay}
                style={getStandStyle}
                onEachFeature={onEachStand}
              />
              {zoom >= 16 && (
                <GeoJSON
                  key={`stands-l-${zoom >= 16}`}
                  data={layers.apron_bay}
                  style={() => ({ opacity:0, fillOpacity:0, weight:0 })}
                  onEachFeature={(feature, layer) => {
                    const id = feature?.properties?.StandNo;
                    if (id) layer.bindTooltip(id, {
                      permanent: true, direction: 'center',
                      className: 'apoc-lbl lbl-stand',
                    });
                  }}
                />
              )}
            </Fragment>
          )}

          {/* Slim narrow-body aircraft icons — white-stroke glitter, dual glow, exact bearing */}
          {vis.apron_bay && zoom >= 14 && Object.entries(gateMap).map(([standNo, gate]) => {
            if (!gate.flight_id) return null;
            const pos = standPositions[standNo];
            if (!pos) return null;

            const fs    = gate.flight_status;
            const color = fs === 'delayed'   ? '#ff4444'
                        : fs === 'boarding'  ? '#22c55e'
                        : fs === 'scheduled' ? '#1d4ed8'
                        : fs === 'arrived'   ? '#dde6f5'
                        : '#1d4ed8';

            /* ── viewBox "-15 -21 30 42"  (30 wide × 42 tall)
               Fuselage  : ±2.5 wide — slim narrow-body silhouette (1:8 width ratio)
               Wings     : root (2.5,0)→(2.5,7.5) | tip (13.5,7)→(13,10.5)
               Engines   : cx=±9.5, cy=7.5 — inside wing at x=9.5 (y∈[4.5,9.5])
               H-stabs   : M 2,13.5 L 7,17 — proportional swept surfaces       ── */
            const asw  = zoom >= 17 ? 38 : zoom >= 16 ? 28 : zoom >= 15 ? 20 : 14;
            const ash  = Math.round(asw * 1.27);
            const sz   = Math.ceil(Math.hypot(asw, ash)) + 8;
            const glow = zoom >= 16 ? 6 : 4;
            const strk = color === '#dde6f5' ? 'rgba(80,130,200,0.9)' : 'rgba(255,255,255,0.85)';
            const intk = color === '#dde6f5' ? 'rgba(40,70,130,0.6)' : 'rgba(0,0,0,0.55)';

            const svg = buildAircraftSVG(color, asw, ash, glow, strk, intk);

            const icon = L.divIcon({
              html: `<div style="width:${sz}px;height:${sz}px;display:flex;align-items:center;justify-content:center">
                       <div style="transform:rotate(${pos.bearing}deg);transform-origin:center;line-height:0">${svg}</div>
                     </div>`,
              className:  '',
              iconSize:   [sz, sz],
              iconAnchor: [sz / 2, sz / 2],
            });

            return (
              <Marker key={`ac-${standNo}`} position={pos.latlng} icon={icon} interactive={false} />
            );
          })}

          {/* ── Live flight movement trails + aircraft ───────────────────── */}
          {Object.entries(liveMovements).map(([fid, mv]) => {
            if (!mv.positions?.length) return null;
            const cur   = mv.positions[mv.positions.length - 1];
            const trail = mv.positions.map(p => [p.lat, p.lng]);
            const mvColor = mv.movement_type === 'departure' ? '#00d4ff' : '#ff9500';
            const asw  = zoom >= 17 ? 38 : zoom >= 16 ? 28 : zoom >= 15 ? 20 : 14;
            const ash  = Math.round(asw * 1.27);
            const sz   = Math.ceil(Math.hypot(asw, ash)) + 8;
            const svg  = buildAircraftSVG(mvColor, asw, ash, 7, 'rgba(255,255,255,0.92)', 'rgba(0,0,0,0.6)');
            const mvIcon = L.divIcon({
              html: `<div style="width:${sz}px;height:${sz}px;display:flex;align-items:center;justify-content:center">
                       <div style="transform:rotate(${cur.heading}deg);transform-origin:center;line-height:0">${svg}</div>
                     </div>`,
              className: '', iconSize: [sz, sz], iconAnchor: [sz / 2, sz / 2],
            });
            return (
              <Fragment key={`mv-${fid}`}>
                {trail.length >= 2 && (
                  <Polyline positions={trail} color={mvColor} weight={2} opacity={0.65} dashArray="5 4" />
                )}
                <Marker
                  key={`mv-ac-${fid}-${mv.positions.length}`}
                  position={[cur.lat, cur.lng]}
                  icon={mvIcon}
                  interactive={false}
                />
              </Fragment>
            );
          })}

          {/* ── Playback aircraft + trail ─────────────────────────────────── */}
          {playback && playback.track?.length > 0 && (() => {
            const cur   = playback.track[playback.idx] || playback.track[0];
            const trail = playback.track.slice(0, playback.idx + 1).map(p => [p.lat, p.lng]);
            const pbColor = playback.movement_type === 'departure' ? '#00d4ff' : '#ff9500';
            const asw  = zoom >= 17 ? 38 : zoom >= 16 ? 28 : zoom >= 15 ? 20 : 14;
            const ash  = Math.round(asw * 1.27);
            const sz   = Math.ceil(Math.hypot(asw, ash)) + 8;
            const svg  = buildAircraftSVG(pbColor, asw, ash, 9, 'rgba(255,255,255,0.92)', 'rgba(0,0,0,0.6)');
            const pbIcon = L.divIcon({
              html: `<div style="width:${sz}px;height:${sz}px;display:flex;align-items:center;justify-content:center">
                       <div style="transform:rotate(${cur.heading}deg);transform-origin:center;line-height:0">${svg}</div>
                     </div>`,
              className: '', iconSize: [sz, sz], iconAnchor: [sz / 2, sz / 2],
            });
            return (
              <Fragment key="pb-mv">
                {trail.length >= 2 && (
                  <Polyline positions={trail} color={pbColor} weight={3} opacity={0.88} />
                )}
                <Marker
                  key={`pb-ac-${playback.idx}`}
                  position={[cur.lat, cur.lng]}
                  icon={pbIcon}
                  interactive={false}
                />
              </Fragment>
            );
          })()}
        </MapContainer>

        {/* ── Stats overlay — bottom-left ────────────────────────────────── */}
        <div style={{
          position:'absolute', bottom:16, left:16, zIndex:900,
          display:'flex', gap:8,
        }}>
          <StatPill label="OCCUPIED"    value={occupied}    color="#4a90d9" />
          <StatPill label="AVAILABLE"   value={available}   color="#48bb78" />
          <StatPill label="MAINTENANCE" value={maintenance} color="#e53e3e" />
        </div>

        {/* ── Layer control — top-right ──────────────────────────────────── */}
        <div style={{
          position:'absolute', top:10, right:10, zIndex:900,
          display:'flex', flexDirection:'column', alignItems:'flex-end', gap:6,
        }}>
          <div style={{ display:'flex', gap:6 }}>
            <button
              onClick={toggleFullscreen}
              title={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              style={{
                background:'rgba(8,12,24,0.88)',
                border:'1px solid rgba(255,255,255,0.15)',
                borderRadius:8, padding:'6px 10px', cursor:'pointer',
                color:'#cbd5e0', display:'flex', alignItems:'center',
                fontSize:14,
              }}
            >
              {isFullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
            </button>
            <button
              onClick={() => { setTracksOpen(p => !p); setPanelOpen(false); }}
              style={{
                background: tracksOpen ? 'rgba(0,212,255,0.18)' : 'rgba(8,12,24,0.88)',
                border: `1px solid ${tracksOpen ? 'rgba(0,212,255,0.5)' : 'rgba(255,255,255,0.15)'}`,
                borderRadius:8, padding:'6px 14px', cursor:'pointer',
                color: tracksOpen ? '#00d4ff' : '#cbd5e0',
                display:'flex', alignItems:'center', gap:7,
                fontSize:11, fontWeight:700, letterSpacing:1,
              }}
            >
              <span style={{ fontSize:13 }}>◈</span> TRACKS
              {(Object.keys(liveMovements).length > 0) && (
                <span style={{
                  background:'#00d4ff', color:'#000', borderRadius:10,
                  fontSize:9, fontWeight:800, padding:'1px 5px',
                }}>
                  {Object.keys(liveMovements).length} LIVE
                </span>
              )}
            </button>
            <button
              onClick={() => setPanelOpen(p => !p)}
              style={{
                background:'rgba(8,12,24,0.88)',
                border:'1px solid rgba(255,255,255,0.15)',
                borderRadius:8, padding:'6px 14px', cursor:'pointer',
                color:'#cbd5e0', display:'flex', alignItems:'center', gap:7,
                fontSize:11, fontWeight:700, letterSpacing:1,
              }}
            >
              <span style={{ fontSize:14 }}>⊞</span> LAYERS
            </button>
          </div>

          {/* ── Tracks panel ────────────────────────────────────────────── */}
          {tracksOpen && (
            <div style={{
              background:'rgba(4,8,18,0.97)',
              border:'1px solid rgba(0,212,255,0.25)',
              borderRadius:10, padding:'12px 14px', width:260,
              maxHeight:'65vh', overflowY:'auto',
            }}>
              <div style={{
                fontSize:10, fontWeight:700, color:'rgba(0,212,255,0.6)',
                letterSpacing:2, marginBottom:10, textTransform:'uppercase',
              }}>
                Flight Tracks
              </div>

              {/* Live movements */}
              {Object.entries(liveMovements).length > 0 && (
                <div style={{ marginBottom:10 }}>
                  <div style={{ fontSize:9, color:'rgba(255,255,255,0.3)', letterSpacing:1.5, marginBottom:6 }}>
                    LIVE NOW
                  </div>
                  {Object.entries(liveMovements).map(([fid, mv]) => (
                    <div key={`live-${fid}`} style={{
                      padding:'6px 8px', borderRadius:6, marginBottom:4,
                      background:'rgba(0,212,255,0.08)',
                      border:'1px solid rgba(0,212,255,0.2)',
                    }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <span style={{ fontSize:12, fontWeight:700, color:'#00d4ff', fontFamily:'monospace' }}>
                          {mv.flight_number}
                        </span>
                        <span style={{
                          fontSize:8, fontWeight:700, letterSpacing:1,
                          color: mv.movement_type === 'departure' ? '#00d4ff' : '#ff9500',
                          background: mv.movement_type === 'departure' ? 'rgba(0,212,255,0.12)' : 'rgba(255,149,0,0.12)',
                          border: `1px solid ${mv.movement_type === 'departure' ? 'rgba(0,212,255,0.3)' : 'rgba(255,149,0,0.3)'}`,
                          borderRadius:4, padding:'1px 5px',
                        }}>
                          {mv.movement_type === 'departure' ? 'DEP' : 'ARR'}
                        </span>
                      </div>
                      <div style={{ fontSize:10, color:'rgba(255,255,255,0.4)', marginTop:2 }}>
                        <span className="mv-phase-dot" /> {mv.phase?.replace('_', ' ')}
                        {' · '}{mv.positions?.length || 0} pts
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Recorded track list from API */}
              {trackList.length > 0 && (
                <div>
                  <div style={{ fontSize:9, color:'rgba(255,255,255,0.3)', letterSpacing:1.5, marginBottom:6 }}>
                    RECORDED TRACKS
                  </div>
                  {trackList.map(tr => (
                    <div
                      key={`tr-${tr.flight_id}`}
                      onClick={() => loadTrackForPlayback(tr.flight_id, tr.flight_number, tr.movement_type)}
                      style={{
                        padding:'6px 8px', borderRadius:6, marginBottom:4,
                        background: playback?.flight_id === tr.flight_id
                          ? 'rgba(0,212,255,0.14)' : 'rgba(255,255,255,0.04)',
                        border: `1px solid ${playback?.flight_id === tr.flight_id ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
                        cursor:'pointer',
                      }}
                    >
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                        <span style={{ fontSize:12, fontWeight:700, color:'#e2e8f0', fontFamily:'monospace' }}>
                          {tr.flight_number}
                        </span>
                        <span style={{
                          fontSize:8, fontWeight:700, letterSpacing:1,
                          color: tr.movement_type === 'departure' ? '#00d4ff' : '#ff9500',
                          background: tr.movement_type === 'departure' ? 'rgba(0,212,255,0.1)' : 'rgba(255,149,0,0.1)',
                          border: `1px solid ${tr.movement_type === 'departure' ? 'rgba(0,212,255,0.25)' : 'rgba(255,149,0,0.25)'}`,
                          borderRadius:4, padding:'1px 5px',
                        }}>
                          {tr.movement_type === 'departure' ? 'DEP' : 'ARR'}
                        </span>
                      </div>
                      <div style={{ fontSize:10, color:'rgba(255,255,255,0.35)', marginTop:2 }}>
                        {tr.point_count} pts · {new Date(tr.started_at).toLocaleTimeString([], { hour:'2-digit', minute:'2-digit' })}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {trackList.length === 0 && Object.keys(liveMovements).length === 0 && (
                <div style={{ fontSize:11, color:'rgba(255,255,255,0.25)', textAlign:'center', padding:'16px 0' }}>
                  No tracks yet — trigger a departure<br />or arrival from the Simulator
                </div>
              )}
            </div>
          )}

          {panelOpen && (
            <div style={{
              background:'rgba(6,10,20,0.96)',
              border:'1px solid rgba(255,255,255,0.1)',
              borderRadius:10, padding:'12px 14px', width:208,
              maxHeight:'68vh', overflowY:'auto',
            }}>
              <div style={{
                fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.35)',
                letterSpacing:2, marginBottom:12, textTransform:'uppercase',
              }}>
                Layer Control
              </div>

              {CATEGORIES.map(({ name: cat, color: catColor }) => {
                const defs = byCategory[cat] || [];
                const extraDef = cat === 'Apron'
                  ? [{ id:'apron_bay', title:'Stands (Live Status)', style:{ color:'#48bb78' } }]
                  : [];
                const allDefs = [...defs, ...extraDef];
                if (!allDefs.length) return null;
                const allOn  = allDefs.every(d => vis[d.id]);
                const someOn = allDefs.some(d => vis[d.id]);

                return (
                  <div key={cat} style={{ marginBottom:12 }}>
                    {/* Category row */}
                    <div
                      onClick={() => toggleCat(cat)}
                      style={{
                        display:'flex', alignItems:'center', gap:7,
                        cursor:'pointer', marginBottom:5,
                      }}
                    >
                      <div style={{
                        width:9, height:9, borderRadius:2, flexShrink:0,
                        background: allOn ? catColor : someOn ? catColor + '60' : '#2d3748',
                      }} />
                      <span style={{
                        fontSize:10, fontWeight:700,
                        color: allOn ? catColor : '#4a5568',
                        textTransform:'uppercase', letterSpacing:1.2,
                      }}>
                        {cat}
                      </span>
                    </div>

                    {/* Layer rows */}
                    {allDefs.map(def => {
                      const dotColor = typeof def.style?.color === 'string'
                        ? def.style.color
                        : def.style?.fillColor || catColor;
                      const needsHigherZoom = def.minZoom && def.minZoom > zoom;
                      return (
                        <div
                          key={def.id}
                          onClick={() => setVis(v => ({ ...v, [def.id]: !v[def.id] }))}
                          style={{
                            display:'flex', alignItems:'center', gap:7,
                            padding:'3px 0 3px 16px', cursor:'pointer',
                          }}
                        >
                          <div style={{
                            width:7, height:7, borderRadius:1, flexShrink:0,
                            background: vis[def.id] ? dotColor : '#2d3748',
                            opacity: vis[def.id] ? 1 : 0.4,
                          }} />
                          <span style={{
                            fontSize:11,
                            color: vis[def.id] ? '#c4cdd8' : '#4a5568',
                          }}>
                            {def.title}
                          </span>
                          {needsHigherZoom && vis[def.id] && (
                            <span style={{ fontSize:9, color:'#4a5568', marginLeft:'auto' }}>
                              z{def.minZoom}+
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── Playback control bar — bottom center ─────────────────────── */}
        {playback && (
          <div style={{
            position:'absolute', bottom:16, left:'50%', transform:'translateX(-50%)',
            zIndex:1000, background:'rgba(4,8,18,0.97)',
            border:'1px solid rgba(0,212,255,0.3)',
            borderRadius:12, padding:'10px 16px', minWidth:380, maxWidth:520,
            boxShadow:'0 4px 24px rgba(0,0,0,0.6)',
          }}>
            {/* Header row */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
              <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                <span style={{ fontSize:13, fontWeight:800, color:'#00d4ff', fontFamily:'monospace' }}>
                  {playback.flight_number}
                </span>
                <span style={{
                  fontSize:9, fontWeight:700, letterSpacing:1,
                  color: playback.movement_type === 'departure' ? '#00d4ff' : '#ff9500',
                  background: playback.movement_type === 'departure' ? 'rgba(0,212,255,0.12)' : 'rgba(255,149,0,0.12)',
                  border: `1px solid ${playback.movement_type === 'departure' ? 'rgba(0,212,255,0.3)' : 'rgba(255,149,0,0.3)'}`,
                  borderRadius:4, padding:'2px 6px',
                }}>
                  {playback.movement_type === 'departure' ? 'DEPARTURE' : 'ARRIVAL'}
                </span>
                {playback.track[playback.idx] && (
                  <span style={{
                    fontSize:9, fontWeight:600, letterSpacing:0.8,
                    color:'rgba(255,255,255,0.45)', fontFamily:'monospace',
                  }}>
                    {playback.track[playback.idx].phase?.replace(/_/g, ' ').toUpperCase()}
                    {' · '}{playback.track[playback.idx].altitude_ft}ft
                    {' · '}{playback.track[playback.idx].ground_speed_kts}kts
                  </span>
                )}
              </div>
              <button
                onClick={() => setPlayback(null)}
                style={{ background:'none', border:'none', cursor:'pointer', color:'rgba(255,255,255,0.35)', fontSize:16, lineHeight:1 }}
              >×</button>
            </div>

            {/* Timeline slider */}
            <input
              type="range"
              min={0}
              max={playback.track.length - 1}
              value={playback.idx}
              onChange={e => setPlayback(pb => pb ? { ...pb, idx: +e.target.value, playing: false } : pb)}
              style={{ width:'100%', accentColor:'#00d4ff', marginBottom:8, cursor:'pointer' }}
            />

            {/* Controls row */}
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                {/* Rewind */}
                <button
                  onClick={() => setPlayback(pb => pb ? { ...pb, idx: 0, playing: false } : pb)}
                  style={{ ...pbBtnStyle }}
                >⏮</button>
                {/* Play/Pause */}
                <button
                  onClick={() => setPlayback(pb => pb ? { ...pb, playing: !pb.playing } : pb)}
                  style={{ ...pbBtnStyle, background:'rgba(0,212,255,0.15)', color:'#00d4ff', border:'1px solid rgba(0,212,255,0.4)', minWidth:38 }}
                >
                  {playback.playing ? '⏸' : '▶'}
                </button>
              </div>

              {/* Speed selector */}
              <div style={{ display:'flex', gap:4 }}>
                {[1, 2, 5, 10].map(sp => (
                  <button
                    key={sp}
                    onClick={() => setPlayback(pb => pb ? { ...pb, speed: sp } : pb)}
                    style={{
                      ...pbBtnStyle,
                      background: playback.speed === sp ? 'rgba(0,212,255,0.2)' : 'transparent',
                      color:      playback.speed === sp ? '#00d4ff' : 'rgba(255,255,255,0.35)',
                      border:     `1px solid ${playback.speed === sp ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.1)'}`,
                      fontSize:9, fontWeight:700,
                    }}
                  >
                    {sp}×
                  </button>
                ))}
              </div>

              {/* Position counter */}
              <span style={{ fontSize:10, color:'rgba(255,255,255,0.3)', fontFamily:'monospace', minWidth:60, textAlign:'right' }}>
                {playback.idx + 1} / {playback.track.length}
              </span>
            </div>
          </div>
        )}

        {/* ── Legend — bottom-right ─────────────────────────────────────── */}
        <div style={{
          position:'absolute', bottom:16, right:16, zIndex:900,
          background:'rgba(5,9,18,0.82)', border:'1px solid rgba(255,255,255,0.1)',
          borderRadius:8, padding:'9px 13px',
          display:'flex', flexDirection:'column', gap:5,
        }}>
          {LEGEND.map(({ color, label, fill, aircraft }) => (
            <div key={label} style={{ display:'flex', alignItems:'center', gap:8 }}>
              {aircraft ? (
                <svg width="11" height="14" viewBox="-15 -21 30 42" xmlns="http://www.w3.org/2000/svg" style={{flexShrink:0}}>
                  <g fill={color} stroke={color === '#dde6f5' ? 'rgba(80,130,200,0.8)' : 'rgba(255,255,255,0.7)'} strokeWidth="1.4" strokeLinejoin="round">
                    <path d="M 0,-20 C 1,-16 2.5,-12 2.5,-7 L 2.5,9 C 2.5,14 1.2,17 0,18.5 C -1.2,17 -2.5,14 -2.5,9 L -2.5,-7 C -2.5,-12 -1,-16 0,-20 Z"/>
                    <path d="M 2.5,0 L 13.5,7 L 13,10.5 L 2.5,7.5 Z"/>
                    <path d="M -2.5,0 L -13.5,7 L -13,10.5 L -2.5,7.5 Z"/>
                    <ellipse cx="9.5"  cy="7.5" rx="2.3" ry="0.85"/>
                    <ellipse cx="-9.5" cy="7.5" rx="2.3" ry="0.85"/>
                    <path d="M  2,13.5 L  7,17 L  6.7,18 L  2,15.5 Z"/>
                    <path d="M -2,13.5 L -7,17 L -6.7,18 L -2,15.5 Z"/>
                  </g>
                </svg>
              ) : (
                <div style={{
                  width:12, height:12, borderRadius:2, flexShrink:0,
                  background:    fill ? color : 'transparent',
                  border:        fill ? 'none' : `2px solid ${color}`,
                  boxShadow:     fill ? `0 0 4px ${color}60` : 'none',
                }} />
              )}
              <Text style={{ fontSize:11, color:'rgba(255,255,255,0.55)' }}>{label}</Text>
            </div>
          ))}
          <div style={{
            marginTop:4, paddingTop:5,
            borderTop:'1px solid rgba(255,255,255,0.08)',
            fontSize:10, color:'rgba(255,255,255,0.25)', letterSpacing:0.5,
          }}>
            {zoom < 15 ? `Zoom in for labels (current: ${zoom})` : `Zoom ${zoom} · Labels active`}
          </div>
        </div>
      </div>

      {/* ── Leaflet tooltip label CSS ────────────────────────────────────────── */}
      <style>{`
        .apoc-lbl {
          background: transparent !important;
          border:     none !important;
          box-shadow: none !important;
          padding:    1px 2px !important;
          font-family: 'Courier New', monospace;
          font-weight: 700;
          white-space: nowrap;
          pointer-events: none !important;
          text-transform: uppercase;
          letter-spacing: 0.6px;
        }
        .apoc-lbl::before { display: none !important; }

        .lbl-runway   { font-size:13px; color:#90cdf4; letter-spacing:2.5px;
                        text-shadow: 0 0 8px #000, 0 0 4px #000, 1px 1px 3px #000, -1px -1px 3px #000; }
        .lbl-terminal { font-size:11px; color:#63b3ed; letter-spacing:1px;
                        text-shadow: 0 0 8px #000, 1px 1px 3px #000, -1px -1px 3px #000; }
        .lbl-taxiway  { font-size:9px;  color:#8fa8c0;
                        text-shadow: 0 0 5px #000, 1px 1px 2px #000; }
        .lbl-apron    { font-size:10px; color:#4a6070; letter-spacing:3px;
                        text-shadow: 0 0 4px #000; }
        .lbl-stand    { font-size:8px;  color:#68d391;
                        text-shadow: 0 0 5px #000, 1px 1px 2px #000; }
        .lbl-holding  { font-size:9px;  color:#f6c060;
                        text-shadow: 0 0 5px #000, 1px 1px 2px #000; }
        .lbl-sap      { font-size:9px;  color:#f6a000;
                        text-shadow: 0 0 5px #000, 1px 1px 2px #000; }

        @keyframes pulse {
          0%,100% { opacity:1; box-shadow:0 0 6px #52c41a; }
          50%      { opacity:.6; box-shadow:0 0 2px #52c41a; }
        }
        @keyframes mvpulse {
          0%,100% { opacity:1; }
          50%      { opacity:0.3; }
        }
        .mv-phase-dot {
          display:inline-block; width:5px; height:5px; border-radius:50%;
          background:#00d4ff; margin-right:2px;
          animation:mvpulse 1.2s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
