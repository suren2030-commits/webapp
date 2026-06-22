-- 003_seed.sql — Add gates for DEL & BOM + sample incidents for all airports
-- Safe to re-run (INSERT IGNORE for gates, incidents are cumulative)
USE webapp_db;

-- ============================================================
-- GATES — DEL  (terminals: T1=id 5 domestic, T3=id 6 international)
-- ============================================================
INSERT IGNORE INTO gates (id, terminal_id, code, type, max_category, has_jetbridge, status) VALUES
  (15, 5, 'C1', 'domestic',      'C', 1, 'active'),
  (16, 5, 'C2', 'domestic',      'C', 1, 'active'),
  (17, 5, 'C3', 'domestic',      'C', 1, 'active'),
  (18, 5, 'C4', 'domestic',      'C', 0, 'active'),
  (19, 5, 'C5', 'domestic',      'C', 0, 'active'),
  (20, 5, 'C6', 'domestic',      'C', 0, 'maintenance'),
  (21, 6, 'A1', 'international', 'E', 1, 'active'),
  (22, 6, 'A2', 'international', 'E', 1, 'active'),
  (23, 6, 'A3', 'international', 'E', 1, 'active'),
  (24, 6, 'A4', 'international', 'C', 1, 'active'),
  (25, 6, 'A5', 'international', 'C', 1, 'active'),
  (26, 6, 'A6', 'international', 'C', 0, 'active');

-- ============================================================
-- GATES — BOM  (terminals: T1=id 7 domestic, T2=id 8 international)
-- ============================================================
INSERT IGNORE INTO gates (id, terminal_id, code, type, max_category, has_jetbridge, status) VALUES
  (27, 7, 'P1', 'domestic',      'C', 1, 'active'),
  (28, 7, 'P2', 'domestic',      'C', 1, 'active'),
  (29, 7, 'P3', 'domestic',      'C', 1, 'active'),
  (30, 7, 'P4', 'domestic',      'C', 0, 'active'),
  (31, 7, 'P5', 'domestic',      'C', 0, 'maintenance'),
  (32, 8, 'Q1', 'international', 'E', 1, 'active'),
  (33, 8, 'Q2', 'international', 'E', 1, 'active'),
  (34, 8, 'Q3', 'international', 'C', 1, 'active'),
  (35, 8, 'Q4', 'international', 'C', 1, 'active'),
  (36, 8, 'Q5', 'international', 'C', 0, 'active');

-- ============================================================
-- INCIDENTS — MAA (airport_id = 1)
-- ============================================================
INSERT INTO incidents (airport_id, title, description, type, severity, status, affected_flight_id, reported_by) VALUES
  (1, 'Fuel spill near Stand S02',
      'Minor fuel spill detected during refueling. Area cordoned off, cleanup crew deployed.',
      'technical', 'high', 'in_progress', NULL, 3),
  (1, 'Medical Emergency — Inbound Flight',
      'Passenger reported chest pain on inbound flight. Medical team on standby at gate B2.',
      'medical', 'critical', 'in_progress', NULL, 2),
  (1, 'Conveyor Belt C2 Fault — Terminal 1',
      'Baggage carousel C2 in T1 stopped due to motor fault. Maintenance team called.',
      'technical', 'medium', 'open', NULL, 3),
  (1, 'Runway 12 FOD Detected',
      'Foreign Object Debris (plastic sheet) reported on runway 12. Runway closed for sweeping.',
      'operational', 'high', 'resolved', NULL, 2),
  (1, 'Ground Power Unit Failure — Apron B',
      'GPU unit #3 on apron B inoperative. Technician dispatched.',
      'technical', 'medium', 'open', NULL, 3),
  (1, 'ILS Localizer Calibration in Progress',
      'ILS localizer on runway 07 undergoing calibration. CAT I operations only until 1000 UTC.',
      'technical', 'low', 'in_progress', NULL, 2);

UPDATE incidents SET resolved_at = NOW() - INTERVAL 3 HOUR WHERE title = 'Runway 12 FOD Detected' AND airport_id = 1;

-- ============================================================
-- INCIDENTS — BLR (airport_id = 2)
-- ============================================================
INSERT INTO incidents (airport_id, title, description, type, severity, status, affected_flight_id, reported_by) VALUES
  (2, 'EK568 Arrival Delay — ATC Hold',
      'EK568 held at FL200 due to ATC congestion. Expected additional 20-min delay.',
      'operational', 'medium', 'in_progress', NULL, 5),
  (2, 'Security Alert — Unattended Baggage T2',
      'Unattended bag found near gate D1. Security team investigating. Gate D1 temporarily closed.',
      'security', 'high', 'open', NULL, 4),
  (2, 'Apron Lighting Fault — North Apron',
      'Three apron lights non-functional on north apron. Maintenance scheduled for tonight.',
      'technical', 'low', 'open', NULL, 5),
  (2, 'Bird Strike Reported — Runway 09L',
      'Runway 09L inspected after bird strike report. No damage found. Runway cleared.',
      'operational', 'medium', 'resolved', NULL, 4);

UPDATE incidents SET resolved_at = NOW() - INTERVAL 1 HOUR WHERE title = 'Bird Strike Reported — Runway 09L' AND airport_id = 2;

-- ============================================================
-- INCIDENTS — DEL (airport_id = 3)
-- ============================================================
INSERT INTO incidents (airport_id, title, description, type, severity, status, affected_flight_id, reported_by) VALUES
  (3, 'T3 Air Conditioning System Partial Failure',
      'AHU units 3 and 4 in Terminal 3 reporting reduced cooling. Maintenance engaged.',
      'technical', 'medium', 'in_progress', NULL, 1),
  (3, 'Runway 29 Closure — Marking Works',
      'Runway 29 temporarily closed for re-marking. Estimated reopen in 2 hours.',
      'operational', 'high', 'open', NULL, 2),
  (3, 'Suspicious Package — Gate A3',
      'Security alerted to unattended parcel near gate A3. Area evacuated, EOD team en route.',
      'security', 'critical', 'in_progress', NULL, 1),
  (3, 'Fuel Truck Breakdown on Taxiway Echo',
      'Fuel truck stalled on taxiway Echo, blocking westbound movement. Tow truck requested.',
      'operational', 'medium', 'resolved', NULL, 2),
  (3, 'Passenger Medical Emergency — Gate C4',
      'Elderly passenger collapsed at gate C4. Ambulance on site. Being stabilized.',
      'medical', 'high', 'in_progress', NULL, 1);

UPDATE incidents SET resolved_at = NOW() - INTERVAL 2 HOUR WHERE title = 'Fuel Truck Breakdown on Taxiway Echo' AND airport_id = 3;

-- ============================================================
-- INCIDENTS — BOM (airport_id = 4)
-- ============================================================
INSERT INTO incidents (airport_id, title, description, type, severity, status, affected_flight_id, reported_by) VALUES
  (4, 'T1 Departure Board System Outage',
      'FIDS screens in T1 departures showing incorrect gate info. IT team working on fix.',
      'technical', 'high', 'in_progress', NULL, 1),
  (4, 'Weather Hold — Heavy Rainfall',
      'Intense rain causing 30-min ground hold on all departures. ATC coordinating.',
      'weather', 'high', 'open', NULL, 2),
  (4, 'Baggage Belt P4 Jammed',
      'Belt P4 in T1 baggage claim jammed with oversized item. Engineers on site.',
      'technical', 'medium', 'open', NULL, 1),
  (4, 'Fire Alarm — Terminal 2 Foodcourt',
      'Fire alarm triggered in T2 foodcourt. Evacuated. Fire team confirmed false alarm.',
      'fire', 'high', 'resolved', NULL, 2),
  (4, 'Tarmac Vehicle Accident — Apron Q',
      'Minor collision between catering truck and baggage cart on apron Q. No injuries. Report filed.',
      'operational', 'medium', 'closed', NULL, 1);

UPDATE incidents SET resolved_at = NOW() - INTERVAL 5 HOUR WHERE title = 'Fire Alarm — Terminal 2 Foodcourt' AND airport_id = 4;
UPDATE incidents SET resolved_at = NOW() - INTERVAL 1 DAY  WHERE title = 'Tarmac Vehicle Accident — Apron Q'  AND airport_id = 4;

-- ============================================================
-- INCIDENT UPDATES (for key incidents above)
-- ============================================================
INSERT INTO incident_updates (incident_id, update_text, updated_by)
SELECT i.id, 'Situation assessed. Team dispatched and working to resolve.', 2
FROM incidents i WHERE i.title = 'T3 Air Conditioning System Partial Failure' AND i.airport_id = 3;

INSERT INTO incident_updates (incident_id, update_text, updated_by)
SELECT i.id, 'EOD team on scene. Bag being X-rayed. Gate A3 to remain closed pending clearance.', 1
FROM incidents i WHERE i.title = 'Suspicious Package — Gate A3' AND i.airport_id = 3;

INSERT INTO incident_updates (incident_id, update_text, updated_by)
SELECT i.id, 'IT team identified root cause — FIDS middleware restart in progress.', 1
FROM incidents i WHERE i.title = 'T1 Departure Board System Outage' AND i.airport_id = 4;

INSERT INTO incident_updates (incident_id, update_text, updated_by)
SELECT i.id, 'Spill contained. Environmental team assessing. Estimated 45 min to clear.', 2
FROM incidents i WHERE i.title = 'Fuel spill near Stand S02' AND i.airport_id = 1;

INSERT INTO incident_updates (incident_id, update_text, updated_by)
SELECT i.id, 'Patient stabilized. Ambulance waiting on apron. Gate B2 staff on standby.', 3
FROM incidents i WHERE i.title = 'Medical Emergency — Inbound Flight' AND i.airport_id = 1;
