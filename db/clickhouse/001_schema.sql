-- APOC ClickHouse Analytics Schema
-- Database: apoc_analytics

-- ============================================================
-- FLIGHT EVENTS
-- Every state change for every flight
-- ============================================================

CREATE TABLE IF NOT EXISTS apoc_analytics.flight_events (
  event_id          UUID            DEFAULT generateUUIDv4(),
  event_time        DateTime        NOT NULL,
  flight_id         UInt64          NOT NULL,
  flight_number     String          NOT NULL,
  airline_iata      String          NOT NULL,
  airport_id        UInt32          NOT NULL,
  event_type        String          NOT NULL,  -- status_change, delay_update, gate_change, stand_change, cancelled
  old_value         String,
  new_value         String,
  delay_minutes     Int16           DEFAULT 0,
  source            String          DEFAULT 'system'  -- system, manual, feed
) ENGINE = MergeTree()
ORDER BY (airport_id, event_time, flight_id)
PARTITION BY toYYYYMM(event_time)
TTL event_time + INTERVAL 2 YEAR;

-- ============================================================
-- PASSENGER FLOW SNAPSHOTS
-- Periodic counts at gates, security, check-in, arrivals hall
-- ============================================================

CREATE TABLE IF NOT EXISTS apoc_analytics.passenger_flow_snapshots (
  snapshot_time     DateTime        NOT NULL,
  airport_id        UInt32          NOT NULL,
  terminal_id       UInt32          NOT NULL,
  location_type     String          NOT NULL,  -- gate, security, checkin, arrivals_hall, boarding
  location_id       UInt32          NOT NULL,
  passenger_count   UInt32          DEFAULT 0,
  queue_length      UInt16          DEFAULT 0,
  wait_time_minutes UInt16          DEFAULT 0
) ENGINE = MergeTree()
ORDER BY (airport_id, snapshot_time, location_type, location_id)
PARTITION BY toYYYYMM(snapshot_time)
TTL snapshot_time + INTERVAL 1 YEAR;

-- ============================================================
-- RESOURCE UTILIZATION SNAPSHOTS
-- Periodic utilization for gates, runways, stands
-- ============================================================

CREATE TABLE IF NOT EXISTS apoc_analytics.resource_utilization_snapshots (
  snapshot_time     DateTime        NOT NULL,
  airport_id        UInt32          NOT NULL,
  resource_type     String          NOT NULL,  -- gate, runway, stand, checkin_desk, carousel
  resource_id       UInt32          NOT NULL,
  is_occupied       UInt8           DEFAULT 0,
  flight_id         UInt64,
  utilization_pct   Float32         DEFAULT 0
) ENGINE = MergeTree()
ORDER BY (airport_id, snapshot_time, resource_type, resource_id)
PARTITION BY toYYYYMM(snapshot_time)
TTL snapshot_time + INTERVAL 1 YEAR;

-- ============================================================
-- DELAY EVENTS
-- Every delay record with cause codes
-- ============================================================

CREATE TABLE IF NOT EXISTS apoc_analytics.delay_events (
  event_time            DateTime        NOT NULL,
  flight_id             UInt64          NOT NULL,
  flight_number         String          NOT NULL,
  airline_iata          String          NOT NULL,
  airport_id            UInt32          NOT NULL,
  delay_type            String          NOT NULL,  -- arrival, departure
  delay_minutes         Int16           NOT NULL,
  delay_cause_code      String,         -- IATA delay codes (e.g. 93 = weather)
  delay_cause_category  String          -- airline, airport, weather, atc, security, other
) ENGINE = MergeTree()
ORDER BY (airport_id, event_time, airline_iata)
PARTITION BY toYYYYMM(event_time)
TTL event_time + INTERVAL 3 YEAR;

-- ============================================================
-- GROUND SERVICE EVENTS
-- Completion and timing of each ground service
-- ============================================================

CREATE TABLE IF NOT EXISTS apoc_analytics.ground_service_events (
  event_time          DateTime        NOT NULL,
  flight_id           UInt64          NOT NULL,
  airport_id          UInt32          NOT NULL,
  service_type        String          NOT NULL,
  service_category    String          NOT NULL,
  provider_id         UInt32          NOT NULL,
  event_type          String          NOT NULL,  -- started, completed, cancelled
  scheduled_duration  UInt16          DEFAULT 0,  -- minutes
  actual_duration     UInt16          DEFAULT 0,  -- minutes
  on_time             UInt8           DEFAULT 1
) ENGINE = MergeTree()
ORDER BY (airport_id, event_time, service_category)
PARTITION BY toYYYYMM(event_time)
TTL event_time + INTERVAL 2 YEAR;

-- ============================================================
-- INCIDENT EVENTS
-- Incident timeline for trend analysis
-- ============================================================

CREATE TABLE IF NOT EXISTS apoc_analytics.incident_events (
  event_time              DateTime        NOT NULL,
  incident_id             UInt64          NOT NULL,
  airport_id              UInt32          NOT NULL,
  incident_type           String          NOT NULL,
  severity                String          NOT NULL,
  event_type              String          NOT NULL,  -- opened, updated, escalated, resolved, closed
  resolution_time_minutes UInt32          DEFAULT 0
) ENGINE = MergeTree()
ORDER BY (airport_id, event_time, incident_type)
PARTITION BY toYYYYMM(event_time)
TTL event_time + INTERVAL 3 YEAR;

-- ============================================================
-- KPI SNAPSHOTS
-- Hourly and daily aggregated operational KPIs per airport
-- ============================================================

CREATE TABLE IF NOT EXISTS apoc_analytics.kpi_snapshots (
  snapshot_time             DateTime        NOT NULL,
  airport_id                UInt32          NOT NULL,
  period_type               String          NOT NULL,  -- hourly, daily
  total_flights             UInt32          DEFAULT 0,
  departed_flights          UInt32          DEFAULT 0,
  arrived_flights           UInt32          DEFAULT 0,
  delayed_flights           UInt32          DEFAULT 0,
  cancelled_flights         UInt32          DEFAULT 0,
  otp_percentage            Float32         DEFAULT 0,   -- on-time performance %
  avg_departure_delay_min   Float32         DEFAULT 0,
  avg_arrival_delay_min     Float32         DEFAULT 0,
  avg_turnaround_min        Float32         DEFAULT 0,
  gate_utilization_pct      Float32         DEFAULT 0,
  runway_utilization_pct    Float32         DEFAULT 0,
  open_incidents            UInt16          DEFAULT 0,
  critical_incidents        UInt16          DEFAULT 0
) ENGINE = MergeTree()
ORDER BY (airport_id, snapshot_time, period_type)
PARTITION BY toYYYYMM(snapshot_time)
TTL snapshot_time + INTERVAL 5 YEAR;

-- ============================================================
-- WEATHER SNAPSHOTS
-- Periodic weather data per airport (affects OTP analysis)
-- ============================================================

CREATE TABLE IF NOT EXISTS apoc_analytics.weather_snapshots (
  snapshot_time         DateTime        NOT NULL,
  airport_id            UInt32          NOT NULL,
  temperature_c         Float32,
  wind_speed_knots      Float32,
  wind_direction_deg    UInt16,
  visibility_m          UInt32,
  ceiling_ft            UInt32,
  weather_condition     String,         -- clear, fog, rain, snow, thunderstorm, etc.
  metar_raw             String
) ENGINE = MergeTree()
ORDER BY (airport_id, snapshot_time)
PARTITION BY toYYYYMM(snapshot_time)
TTL snapshot_time + INTERVAL 1 YEAR;
