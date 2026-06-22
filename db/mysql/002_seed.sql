-- APOC Seed Data
USE webapp_db;

-- Clean slate (safe to re-run)
SET FOREIGN_KEY_CHECKS = 0;
TRUNCATE TABLE operational_notes;
TRUNCATE TABLE incident_updates;
TRUNCATE TABLE alerts;
TRUNCATE TABLE notams;
TRUNCATE TABLE incidents;
TRUNCATE TABLE flight_ground_services;
TRUNCATE TABLE flight_carousel_assignments;
TRUNCATE TABLE flight_checkin_assignments;
TRUNCATE TABLE flight_runway_assignments;
TRUNCATE TABLE flight_stand_assignments;
TRUNCATE TABLE flight_gate_assignments;
TRUNCATE TABLE flights;
TRUNCATE TABLE ground_service_providers;
TRUNCATE TABLE ground_service_types;
TRUNCATE TABLE staff;
TRUNCATE TABLE checkin_desks;
TRUNCATE TABLE baggage_carousels;
TRUNCATE TABLE stands;
TRUNCATE TABLE runways;
TRUNCATE TABLE gates;
TRUNCATE TABLE aircraft_types;
TRUNCATE TABLE airlines;
TRUNCATE TABLE terminals;
TRUNCATE TABLE airports;
SET FOREIGN_KEY_CHECKS = 1;

-- ============================================================
-- REFERENCE DATA
-- ============================================================

INSERT INTO airports (iata_code, icao_code, name, city, country, timezone, latitude, longitude) VALUES
  ('MAA', 'VOMM', 'Chennai International Airport',        'Chennai',   'India', 'Asia/Kolkata',  13.0827,  80.2707),
  ('BLR', 'VOBL', 'Kempegowda International Airport',     'Bangalore', 'India', 'Asia/Kolkata',  13.1986,  77.7066),
  ('DEL', 'VIDP', 'Indira Gandhi International Airport',  'Delhi',     'India', 'Asia/Kolkata',  28.5562,  77.1000),
  ('BOM', 'VABB', 'Chhatrapati Shivaji Maharaj Intl',     'Mumbai',    'India', 'Asia/Kolkata',  19.0896,  72.8656),
  ('DXB', 'OMDB', 'Dubai International Airport',          'Dubai',     'UAE',   'Asia/Dubai',    25.2532,  55.3657),
  ('DOH', 'OTHH', 'Hamad International Airport',          'Doha',      'Qatar', 'Asia/Qatar',    25.2731,  51.6080);

INSERT INTO terminals (airport_id, code, name, type) VALUES
  (1, 'T1', 'Terminal 1 – Domestic',       'domestic'),
  (1, 'T4', 'Terminal 4 – International',  'international'),
  (2, 'T1', 'Terminal 1 – Domestic',       'domestic'),
  (2, 'T2', 'Terminal 2 – International',  'international'),
  (3, 'T1', 'Terminal 1',                  'domestic'),
  (3, 'T3', 'Terminal 3 – International',  'international'),
  (4, 'T1', 'Terminal 1',                  'domestic'),
  (4, 'T2', 'Terminal 2 – International',  'international');

INSERT INTO airlines (iata_code, icao_code, name, country) VALUES
  ('6E', 'IGO', 'IndiGo',        'India'),
  ('AI', 'AIC', 'Air India',     'India'),
  ('UK', 'VTI', 'Vistara',       'India'),
  ('SG', 'SEJ', 'SpiceJet',      'India'),
  ('EK', 'UAE', 'Emirates',      'UAE'),
  ('QR', 'QTR', 'Qatar Airways', 'Qatar');

INSERT INTO aircraft_types (iata_code, icao_code, manufacturer, model, category, max_passengers) VALUES
  ('320', 'A320', 'Airbus',  'A320-200',  'C', 150),
  ('321', 'A321', 'Airbus',  'A321neo',   'C', 180),
  ('73H', 'B738', 'Boeing',  '737-800',   'C', 162),
  ('77W', 'B77W', 'Boeing',  '777-300ER', 'E', 350),
  ('359', 'A359', 'Airbus',  'A350-900',  'E', 300),
  ('ATR', 'AT76', 'ATR',     'ATR 72-600','B',  70);

-- ============================================================
-- RESOURCES — MAA
-- ============================================================

INSERT INTO gates (terminal_id, code, type, max_category, has_jetbridge, status) VALUES
  (1, 'A1', 'domestic',      'C', 1, 'active'),
  (1, 'A2', 'domestic',      'C', 1, 'active'),
  (1, 'A3', 'domestic',      'C', 0, 'active'),
  (1, 'A4', 'domestic',      'C', 0, 'active'),
  (2, 'B1', 'international', 'E', 1, 'active'),
  (2, 'B2', 'international', 'E', 1, 'active'),
  (2, 'B3', 'international', 'C', 1, 'active'),
  (2, 'B4', 'international', 'C', 1, 'maintenance');

-- RESOURCES — BLR
INSERT INTO gates (terminal_id, code, type, max_category, has_jetbridge, status) VALUES
  (3, 'C1', 'domestic',      'C', 1, 'active'),
  (3, 'C2', 'domestic',      'C', 1, 'active'),
  (3, 'C3', 'domestic',      'C', 0, 'active'),
  (4, 'D1', 'international', 'E', 1, 'active'),
  (4, 'D2', 'international', 'E', 1, 'active'),
  (4, 'D3', 'international', 'C', 1, 'active');

INSERT INTO runways (airport_id, designator, length_m, width_m, surface_type, status) VALUES
  (1, '07',  3658, 45, 'asphalt', 'active'),
  (1, '25',  3658, 45, 'asphalt', 'active'),
  (1, '12',  2900, 45, 'asphalt', 'active'),
  (2, '09L', 4000, 60, 'asphalt', 'active'),
  (2, '27R', 4000, 60, 'asphalt', 'active'),
  (2, '09R', 2500, 45, 'asphalt', 'maintenance');

INSERT INTO stands (airport_id, code, type, max_category, status) VALUES
  (1, 'S01', 'contact', 'E', 'active'),
  (1, 'S02', 'contact', 'E', 'active'),
  (1, 'S03', 'contact', 'C', 'active'),
  (1, 'R01', 'remote',  'C', 'active'),
  (1, 'R02', 'remote',  'C', 'active'),
  (2, 'S01', 'contact', 'E', 'active'),
  (2, 'S02', 'contact', 'C', 'active'),
  (2, 'R01', 'remote',  'C', 'active');

INSERT INTO checkin_desks (terminal_id, desk_number, status) VALUES
  (1,'D01','active'),(1,'D02','active'),(1,'D03','active'),(1,'D04','active'),
  (2,'D01','active'),(2,'D02','active'),(2,'D03','active'),
  (3,'D01','active'),(3,'D02','active'),(3,'D03','active'),
  (4,'D01','active'),(4,'D02','active');

INSERT INTO baggage_carousels (terminal_id, number, status) VALUES
  (1,'C1','active'),(1,'C2','active'),
  (2,'C1','active'),(2,'C2','active'),
  (3,'C1','active'),
  (4,'C1','active');

-- ============================================================
-- GROUND HANDLING
-- ============================================================

INSERT INTO ground_service_types (name, category) VALUES
  ('Fueling',        'fueling'),
  ('Cabin Cleaning', 'cleaning'),
  ('Catering',       'catering'),
  ('Baggage Unload', 'baggage'),
  ('Baggage Load',   'baggage'),
  ('Pushback',       'pushback'),
  ('De-icing',       'deicing'),
  ('Marshalling',    'marshalling');

INSERT INTO ground_service_providers (airport_id, name, contact) VALUES
  (1, 'MAA Ground Services Ltd',  'ops@maaground.in'),
  (1, 'Chennai Fuels Corp',       'fuel@chennaifuels.in'),
  (2, 'BLR Aviation Handlers',    'ops@blrhandlers.in'),
  (2, 'Bangalore Fuel Solutions', 'fuel@blrfuel.in');

-- ============================================================
-- STAFF
-- ============================================================

INSERT INTO staff (keycloak_user_id, full_name, role, airport_id) VALUES
  ('00000000-0000-0000-0000-000000000001', 'Surendran R',    'admin',      1),
  ('00000000-0000-0000-0000-000000000002', 'Priya Nair',     'supervisor', 1),
  ('00000000-0000-0000-0000-000000000003', 'Karthik Selvam', 'controller', 1),
  ('00000000-0000-0000-0000-000000000004', 'Divya Menon',    'supervisor', 2),
  ('00000000-0000-0000-0000-000000000005', 'Arun Krishnan',  'controller', 2);

-- ============================================================
-- FLIGHTS  (today = 2026-06-22, times in UTC)
-- airport_id: 1=MAA  2=BLR  3=DEL  4=BOM  5=DXB  6=DOH
-- ============================================================

INSERT INTO flights
  (flight_number, airline_id, aircraft_type_id, aircraft_registration,
   origin_airport_id, destination_airport_id, flight_type,
   scheduled_departure, scheduled_arrival,
   estimated_departure, estimated_arrival,
   actual_departure, actual_arrival,
   status, passenger_count)
VALUES
  -- Departed / arrived (history)
  ('6E201', 1, 1, 'VT-INA', 1, 3, 'departure', '2026-06-22 01:30:00', '2026-06-22 04:00:00', '2026-06-22 01:30:00', '2026-06-22 04:00:00', '2026-06-22 01:32:00', NULL,                  'departed', 142),
  ('AI542', 2, 3, 'VT-AXC', 3, 1, 'arrival',   '2026-06-22 00:00:00', '2026-06-22 02:30:00', NULL,                  NULL,                  NULL,                  '2026-06-22 02:28:00', 'arrived',  155),
  ('UK831', 3, 2, 'VT-TNC', 1, 4, 'departure', '2026-06-22 02:00:00', '2026-06-22 04:00:00', NULL,                  NULL,                  '2026-06-22 02:05:00', NULL,                  'departed', 165),
  ('SG104', 4, 1, 'VT-SJA', 4, 1, 'arrival',   '2026-06-21 22:00:00', '2026-06-22 00:20:00', NULL,                  NULL,                  NULL,                  '2026-06-22 00:25:00', 'arrived',  138),

  -- Active / boarding / delayed — MAA
  ('6E455', 1, 2, 'VT-INB', 1, 4, 'departure', '2026-06-22 07:30:00', '2026-06-22 09:30:00', NULL,                  NULL,                  NULL,                  NULL,                  'boarding', 158),
  ('AI101', 2, 5, 'VT-AIX', 3, 1, 'arrival',   '2026-06-22 05:00:00', '2026-06-22 07:45:00', NULL,                  '2026-06-22 08:00:00', NULL,                  NULL,                  'delayed',  290),
  ('EK544', 5, 4, 'A6-EBK', 5, 1, 'arrival',   '2026-06-22 06:00:00', '2026-06-22 08:30:00', NULL,                  NULL,                  NULL,                  NULL,                  'boarding', 320),

  -- Upcoming scheduled — MAA
  ('6E312', 1, 1, 'VT-INC', 1, 3, 'departure', '2026-06-22 09:45:00', '2026-06-22 12:15:00', NULL, NULL, NULL, NULL, 'scheduled', 148),
  ('UK204', 3, 2, 'VT-TND', 4, 1, 'arrival',   '2026-06-22 08:00:00', '2026-06-22 10:30:00', NULL, NULL, NULL, NULL, 'scheduled', 172),
  ('SG218', 4, 3, 'VT-SJB', 1, 4, 'departure', '2026-06-22 11:00:00', '2026-06-22 13:10:00', NULL, NULL, NULL, NULL, 'scheduled', 155),
  ('QR524', 6, 4, 'A7-BAH', 6, 1, 'arrival',   '2026-06-22 07:00:00', '2026-06-22 09:00:00', NULL, NULL, NULL, NULL, 'scheduled', 340),
  ('AI543', 2, 3, 'VT-AXD', 1, 3, 'departure', '2026-06-22 13:00:00', '2026-06-22 15:30:00', NULL, NULL, NULL, NULL, 'scheduled', 161),
  ('6E718', 1, 2, 'VT-IND', 4, 1, 'arrival',   '2026-06-22 12:00:00', '2026-06-22 14:30:00', NULL, NULL, NULL, NULL, 'scheduled', 170),

  -- BLR flights
  ('6E501', 1, 1, 'VT-INE', 2, 3, 'departure', '2026-06-22 02:00:00', '2026-06-22 04:30:00', NULL, NULL, '2026-06-22 02:08:00', NULL,                  'departed', 144),
  ('AI202', 2, 2, 'VT-AXE', 3, 2, 'arrival',   '2026-06-22 01:00:00', '2026-06-22 03:30:00', NULL, NULL, NULL,                  '2026-06-22 03:28:00', 'arrived',  168),
  ('UK501', 3, 2, 'VT-TNE', 2, 4, 'departure', '2026-06-22 07:00:00', '2026-06-22 09:00:00', NULL, NULL, NULL, NULL, 'boarding',  177),
  ('EK568', 5, 4, 'A6-EBL', 5, 2, 'arrival',   '2026-06-22 05:30:00', '2026-06-22 08:00:00', '2026-06-22 05:30:00', '2026-06-22 08:20:00', NULL, NULL, 'delayed', 318),
  ('6E612', 1, 1, 'VT-INF', 2, 3, 'departure', '2026-06-22 10:00:00', '2026-06-22 12:30:00', NULL, NULL, NULL, NULL, 'scheduled', 152),
  ('SG310', 4, 3, 'VT-SJC', 4, 2, 'arrival',   '2026-06-22 09:00:00', '2026-06-22 11:30:00', NULL, NULL, NULL, NULL, 'scheduled', 158),
  ('QR542', 6, 5, 'A7-ALD', 6, 2, 'arrival',   '2026-06-22 10:00:00', '2026-06-22 12:30:00', NULL, NULL, NULL, NULL, 'scheduled', 288);

-- ============================================================
-- GATE ASSIGNMENTS
-- ============================================================

INSERT INTO flight_gate_assignments (flight_id, gate_id, from_time, to_time, status) VALUES
  (5,  1, '2026-06-22 07:00:00', '2026-06-22 08:30:00', 'active'),
  (7,  5, '2026-06-22 08:00:00', '2026-06-22 09:30:00', 'active'),
  (6,  6, '2026-06-22 07:30:00', '2026-06-22 09:00:00', 'planned'),
  (8,  2, '2026-06-22 09:15:00', '2026-06-22 10:45:00', 'planned'),
  (10, 3, '2026-06-22 10:30:00', '2026-06-22 12:00:00', 'planned'),
  (11, 5, '2026-06-22 09:00:00', '2026-06-22 10:30:00', 'planned'),
  (12, 4, '2026-06-22 12:30:00', '2026-06-22 14:00:00', 'planned'),
  (16, 9,  '2026-06-22 06:30:00', '2026-06-22 08:00:00', 'active'),
  (17, 12, '2026-06-22 07:30:00', '2026-06-22 09:00:00', 'planned'),
  (18, 10, '2026-06-22 09:30:00', '2026-06-22 11:00:00', 'planned'),
  (19, 11, '2026-06-22 08:30:00', '2026-06-22 10:30:00', 'planned');

-- ============================================================
-- RUNWAY ASSIGNMENTS
-- ============================================================

INSERT INTO flight_runway_assignments (flight_id, runway_id, assignment_type, scheduled_time, actual_time, status) VALUES
  (1,  1, 'departure', '2026-06-22 01:30:00', '2026-06-22 01:32:00', 'completed'),
  (2,  2, 'arrival',   '2026-06-22 02:30:00', '2026-06-22 02:28:00', 'completed'),
  (3,  1, 'departure', '2026-06-22 02:00:00', '2026-06-22 02:05:00', 'completed'),
  (5,  2, 'departure', '2026-06-22 07:30:00', NULL,                  'planned'),
  (7,  1, 'arrival',   '2026-06-22 08:30:00', NULL,                  'planned'),
  (14, 4, 'departure', '2026-06-22 02:00:00', '2026-06-22 02:08:00', 'completed'),
  (16, 4, 'departure', '2026-06-22 07:00:00', NULL,                  'planned');

-- ============================================================
-- STAND ASSIGNMENTS
-- ============================================================

INSERT INTO flight_stand_assignments (flight_id, stand_id, from_time, to_time, status) VALUES
  (5,  3, '2026-06-22 06:30:00', '2026-06-22 08:30:00', 'active'),
  (7,  1, '2026-06-22 07:30:00', '2026-06-22 10:00:00', 'active'),
  (6,  2, '2026-06-22 07:00:00', '2026-06-22 09:30:00', 'active'),
  (11, 1, '2026-06-22 08:30:00', '2026-06-22 10:30:00', 'planned');

-- ============================================================
-- GROUND SERVICES
-- ============================================================

INSERT INTO flight_ground_services
  (flight_id, service_type_id, provider_id, scheduled_start, scheduled_end, actual_start, actual_end, status)
VALUES
  (5, 1, 2, '2026-06-22 06:30:00', '2026-06-22 07:00:00', '2026-06-22 06:32:00', '2026-06-22 07:02:00', 'completed'),
  (5, 2, 1, '2026-06-22 06:00:00', '2026-06-22 06:45:00', '2026-06-22 06:05:00', '2026-06-22 06:50:00', 'completed'),
  (5, 3, 1, '2026-06-22 06:45:00', '2026-06-22 07:15:00', '2026-06-22 06:50:00', NULL,                  'in_progress'),
  (5, 6, 1, '2026-06-22 07:25:00', '2026-06-22 07:35:00', NULL,                  NULL,                  'pending'),
  (7, 1, 2, '2026-06-22 07:30:00', '2026-06-22 08:00:00', '2026-06-22 07:35:00', NULL,                  'in_progress'),
  (7, 2, 1, '2026-06-22 07:00:00', '2026-06-22 07:45:00', '2026-06-22 07:05:00', '2026-06-22 07:50:00', 'completed'),
  (7, 3, 1, '2026-06-22 07:45:00', '2026-06-22 08:15:00', NULL,                  NULL,                  'pending');

-- ============================================================
-- INCIDENTS
-- ============================================================

INSERT INTO incidents (airport_id, title, description, type, severity, status, affected_flight_id, reported_by) VALUES
  (1, 'Fuel spill near Stand S02',
      'Minor fuel spill detected during refueling of EK544. Area cordoned off, cleanup crew deployed.',
      'technical', 'high', 'in_progress', 7, 3),
  (1, 'AI101 Medical Emergency On Board',
      'Passenger reported chest pain on inbound AI101. Medical team on standby at gate B2.',
      'medical', 'critical', 'in_progress', 6, 2),
  (1, 'Conveyor Belt C2 Fault – Terminal 1',
      'Baggage carousel C2 in T1 stopped due to motor fault. Maintenance team called.',
      'technical', 'medium', 'open', NULL, 3),
  (2, 'EK568 Arrival Delay – ATC Hold',
      'EK568 held at FL200 due to ATC congestion over BLR. Expected additional 20-min delay.',
      'operational', 'medium', 'in_progress', 17, 5),
  (2, 'Security Alert – Unattended Baggage T2',
      'Unattended bag found near gate D1. Security team investigating. Gate D1 temporarily closed.',
      'security', 'high', 'open', NULL, 4),
  (1, 'Runway 12 FOD Detected',
      'Foreign Object Debris (plastic sheet) reported on runway 12. Runway closed for sweeping.',
      'operational', 'high', 'resolved', NULL, 2);

UPDATE incidents SET resolved_at = '2026-06-22 05:45:00' WHERE id = 6;

INSERT INTO incident_updates (incident_id, update_text, updated_by) VALUES
  (1, 'Fire truck and spill kit dispatched to Stand S02. EK544 fueling suspended.',  3),
  (1, 'Spill contained. Environmental team assessing. Estimated 45 min to clear.',   2),
  (2, 'Airport medical team (Dr. Ramesh) on standby at gate B2.',                    2),
  (2, 'Patient stabilized on board. Ambulance waiting on apron.',                    3),
  (4, 'Coordination with BLR ATC ongoing. Revised ETA 08:20 UTC.',                  5),
  (5, 'Security sweep initiated. Bomb disposal squad notified as precaution.',       4),
  (6, 'Runway cleared at 05:40 UTC. Inspection complete. Runway 12 reopened.',       2);

-- ============================================================
-- NOTAMs
-- ============================================================

INSERT INTO notams (airport_id, reference, title, description, category, effective_from, effective_to, status) VALUES
  (1, 'A0142/26', 'Taxiway Bravo Partial Closure',
      'Taxiway B between stands S02 and S03 closed 0300-0800 UTC daily for marking renewal.',
      'aerodrome', '2026-06-20 03:00:00', '2026-06-25 08:00:00', 'active'),
  (1, 'A0138/26', 'ILS 07 Localizer Maintenance',
      'ILS Localizer on runway 07 undergoing calibration. CAT I operations only.',
      'navigation', '2026-06-22 06:00:00', '2026-06-22 10:00:00', 'active'),
  (2, 'B0089/26', 'New SID Procedures Effective',
      'RNAV SID ARORA 2A and GULUR 3A effective from 2026-06-20 on all runways.',
      'navigation', '2026-06-20 00:00:00', '2026-09-20 00:00:00', 'active'),
  (2, 'B0091/26', 'Apron Lighting Upgrade Works',
      'North apron lighting upgrade in progress. Reduced visibility near stands R01-R03 at night.',
      'aerodrome', '2026-06-18 00:00:00', '2026-06-30 00:00:00', 'active');

-- ============================================================
-- ALERTS
-- ============================================================

INSERT INTO alerts (airport_id, type, severity, message, flight_id, auto_generated, expires_at) VALUES
  (1, 'flight_delay',      'warning',  'AI101 arrival delayed 15 min – gate B2 reassignment may be required.',  6,  1, '2026-06-22 10:00:00'),
  (1, 'ground_service',    'warning',  'EK544 catering not yet started – departure at risk.',                    7,  1, '2026-06-22 09:00:00'),
  (1, 'incident_critical', 'critical', 'Medical emergency on AI101. All gate B2 staff to stand by.',            6,  1, '2026-06-22 10:00:00'),
  (2, 'flight_delay',      'warning',  'EK568 delayed 20 min. Gate D1 hold extended.',                          17, 1, '2026-06-22 10:00:00'),
  (2, 'security',          'critical', 'Security alert at gate D1 – gate closed until further notice.',         NULL,1, '2026-06-22 11:00:00');
