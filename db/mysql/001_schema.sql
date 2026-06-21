-- APOC MySQL Schema
-- Database: webapp_db

USE webapp_db;

-- ============================================================
-- REFERENCE / MASTER DATA
-- ============================================================

CREATE TABLE airports (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  iata_code     CHAR(3)      NOT NULL UNIQUE,
  icao_code     CHAR(4)      NOT NULL UNIQUE,
  name          VARCHAR(100) NOT NULL,
  city          VARCHAR(100) NOT NULL,
  country       VARCHAR(100) NOT NULL,
  timezone      VARCHAR(50)  NOT NULL,
  latitude      DECIMAL(9,6) NOT NULL,
  longitude     DECIMAL(9,6) NOT NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE terminals (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  airport_id    INT UNSIGNED NOT NULL,
  code          VARCHAR(10)  NOT NULL,
  name          VARCHAR(100) NOT NULL,
  type          ENUM('domestic','international','both') NOT NULL DEFAULT 'both',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (airport_id) REFERENCES airports(id),
  UNIQUE KEY uq_terminal (airport_id, code)
);

CREATE TABLE airlines (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  iata_code     CHAR(2)      NOT NULL UNIQUE,
  icao_code     CHAR(3)      NOT NULL UNIQUE,
  name          VARCHAR(100) NOT NULL,
  country       VARCHAR(100) NOT NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE aircraft_types (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  iata_code     CHAR(3)      NOT NULL UNIQUE,
  icao_code     CHAR(4)      NOT NULL UNIQUE,
  manufacturer  VARCHAR(50)  NOT NULL,
  model         VARCHAR(50)  NOT NULL,
  category      ENUM('A','B','C','D','E','F') NOT NULL,  -- ICAO wake turbulence category
  max_passengers SMALLINT UNSIGNED NOT NULL,
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- RESOURCES
-- ============================================================

CREATE TABLE gates (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  terminal_id   INT UNSIGNED NOT NULL,
  code          VARCHAR(10)  NOT NULL,
  type          ENUM('domestic','international','both') NOT NULL DEFAULT 'both',
  max_category  ENUM('A','B','C','D','E','F') NOT NULL DEFAULT 'F',
  has_jetbridge TINYINT(1)   NOT NULL DEFAULT 1,
  status        ENUM('active','inactive','maintenance') NOT NULL DEFAULT 'active',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (terminal_id) REFERENCES terminals(id),
  UNIQUE KEY uq_gate (terminal_id, code)
);

CREATE TABLE runways (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  airport_id    INT UNSIGNED NOT NULL,
  designator    VARCHAR(10)  NOT NULL,  -- e.g. 27L, 09R
  length_m      SMALLINT UNSIGNED NOT NULL,
  width_m       TINYINT UNSIGNED NOT NULL,
  surface_type  ENUM('asphalt','concrete','gravel') NOT NULL DEFAULT 'asphalt',
  status        ENUM('active','closed','maintenance') NOT NULL DEFAULT 'active',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (airport_id) REFERENCES airports(id),
  UNIQUE KEY uq_runway (airport_id, designator)
);

CREATE TABLE stands (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  airport_id    INT UNSIGNED NOT NULL,
  code          VARCHAR(10)  NOT NULL,
  type          ENUM('contact','remote') NOT NULL DEFAULT 'contact',
  max_category  ENUM('A','B','C','D','E','F') NOT NULL DEFAULT 'F',
  status        ENUM('active','inactive','maintenance') NOT NULL DEFAULT 'active',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (airport_id) REFERENCES airports(id),
  UNIQUE KEY uq_stand (airport_id, code)
);

CREATE TABLE checkin_desks (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  terminal_id   INT UNSIGNED NOT NULL,
  desk_number   VARCHAR(10)  NOT NULL,
  status        ENUM('active','inactive','maintenance') NOT NULL DEFAULT 'active',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (terminal_id) REFERENCES terminals(id),
  UNIQUE KEY uq_desk (terminal_id, desk_number)
);

CREATE TABLE baggage_carousels (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  terminal_id   INT UNSIGNED NOT NULL,
  number        VARCHAR(10)  NOT NULL,
  status        ENUM('active','inactive','maintenance') NOT NULL DEFAULT 'active',
  created_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (terminal_id) REFERENCES terminals(id),
  UNIQUE KEY uq_carousel (terminal_id, number)
);

-- ============================================================
-- FLIGHTS
-- ============================================================

CREATE TABLE flights (
  id                    BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  flight_number         VARCHAR(10)  NOT NULL,
  airline_id            INT UNSIGNED NOT NULL,
  aircraft_type_id      INT UNSIGNED,
  aircraft_registration VARCHAR(10),
  origin_airport_id     INT UNSIGNED NOT NULL,
  destination_airport_id INT UNSIGNED NOT NULL,
  flight_type           ENUM('arrival','departure','transit') NOT NULL,
  scheduled_departure   DATETIME     NOT NULL,
  scheduled_arrival     DATETIME     NOT NULL,
  estimated_departure   DATETIME,
  estimated_arrival     DATETIME,
  actual_departure      DATETIME,
  actual_arrival        DATETIME,
  status                ENUM('scheduled','boarding','departed','arrived','delayed','cancelled','diverted') NOT NULL DEFAULT 'scheduled',
  passenger_count       SMALLINT UNSIGNED,
  codeshare_of          BIGINT UNSIGNED,  -- FK to parent flight if codeshare
  created_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at            DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (airline_id) REFERENCES airlines(id),
  FOREIGN KEY (aircraft_type_id) REFERENCES aircraft_types(id),
  FOREIGN KEY (origin_airport_id) REFERENCES airports(id),
  FOREIGN KEY (destination_airport_id) REFERENCES airports(id),
  KEY idx_flight_number (flight_number),
  KEY idx_scheduled_departure (scheduled_departure),
  KEY idx_status (status)
);

-- ============================================================
-- RESOURCE ASSIGNMENTS
-- ============================================================

CREATE TABLE flight_gate_assignments (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  flight_id   BIGINT UNSIGNED NOT NULL,
  gate_id     INT UNSIGNED    NOT NULL,
  from_time   DATETIME        NOT NULL,
  to_time     DATETIME        NOT NULL,
  status      ENUM('planned','active','completed','cancelled') NOT NULL DEFAULT 'planned',
  assigned_by INT UNSIGNED,
  notes       TEXT,
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (flight_id) REFERENCES flights(id),
  FOREIGN KEY (gate_id) REFERENCES gates(id),
  KEY idx_gate_time (gate_id, from_time, to_time)
);

CREATE TABLE flight_stand_assignments (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  flight_id   BIGINT UNSIGNED NOT NULL,
  stand_id    INT UNSIGNED    NOT NULL,
  from_time   DATETIME        NOT NULL,
  to_time     DATETIME        NOT NULL,
  status      ENUM('planned','active','completed','cancelled') NOT NULL DEFAULT 'planned',
  assigned_by INT UNSIGNED,
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (flight_id) REFERENCES flights(id),
  FOREIGN KEY (stand_id) REFERENCES stands(id)
);

CREATE TABLE flight_runway_assignments (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  flight_id       BIGINT UNSIGNED NOT NULL,
  runway_id       INT UNSIGNED    NOT NULL,
  assignment_type ENUM('arrival','departure') NOT NULL,
  scheduled_time  DATETIME        NOT NULL,
  actual_time     DATETIME,
  status          ENUM('planned','active','completed','cancelled') NOT NULL DEFAULT 'planned',
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (flight_id) REFERENCES flights(id),
  FOREIGN KEY (runway_id) REFERENCES runways(id)
);

CREATE TABLE flight_checkin_assignments (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  flight_id   BIGINT UNSIGNED NOT NULL,
  desk_id     INT UNSIGNED    NOT NULL,
  from_time   DATETIME        NOT NULL,
  to_time     DATETIME        NOT NULL,
  status      ENUM('planned','active','completed','cancelled') NOT NULL DEFAULT 'planned',
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (flight_id) REFERENCES flights(id),
  FOREIGN KEY (desk_id) REFERENCES checkin_desks(id)
);

CREATE TABLE flight_carousel_assignments (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  flight_id     BIGINT UNSIGNED NOT NULL,
  carousel_id   INT UNSIGNED    NOT NULL,
  from_time     DATETIME        NOT NULL,
  to_time       DATETIME        NOT NULL,
  status        ENUM('planned','active','completed','cancelled') NOT NULL DEFAULT 'planned',
  created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (flight_id) REFERENCES flights(id),
  FOREIGN KEY (carousel_id) REFERENCES baggage_carousels(id)
);

-- ============================================================
-- GROUND HANDLING
-- ============================================================

CREATE TABLE ground_service_providers (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  airport_id  INT UNSIGNED NOT NULL,
  name        VARCHAR(100) NOT NULL,
  contact     VARCHAR(100),
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (airport_id) REFERENCES airports(id)
);

CREATE TABLE ground_service_types (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name        VARCHAR(50)  NOT NULL UNIQUE,
  category    ENUM('fueling','catering','cleaning','baggage','pushback','deicing','marshalling','other') NOT NULL
);

CREATE TABLE flight_ground_services (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  flight_id       BIGINT UNSIGNED NOT NULL,
  service_type_id INT UNSIGNED    NOT NULL,
  provider_id     INT UNSIGNED    NOT NULL,
  scheduled_start DATETIME        NOT NULL,
  scheduled_end   DATETIME        NOT NULL,
  actual_start    DATETIME,
  actual_end      DATETIME,
  status          ENUM('pending','in_progress','completed','cancelled') NOT NULL DEFAULT 'pending',
  notes           TEXT,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (flight_id) REFERENCES flights(id),
  FOREIGN KEY (service_type_id) REFERENCES ground_service_types(id),
  FOREIGN KEY (provider_id) REFERENCES ground_service_providers(id)
);

-- ============================================================
-- INCIDENTS & ALERTS
-- ============================================================

CREATE TABLE incidents (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  airport_id      INT UNSIGNED    NOT NULL,
  title           VARCHAR(200)    NOT NULL,
  description     TEXT,
  type            ENUM('technical','weather','security','medical','operational','fire','other') NOT NULL,
  severity        ENUM('low','medium','high','critical') NOT NULL,
  status          ENUM('open','in_progress','resolved','closed') NOT NULL DEFAULT 'open',
  affected_flight_id BIGINT UNSIGNED,
  reported_by     INT UNSIGNED,
  resolved_at     DATETIME,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (airport_id) REFERENCES airports(id),
  FOREIGN KEY (affected_flight_id) REFERENCES flights(id),
  KEY idx_airport_status (airport_id, status),
  KEY idx_severity (severity)
);

CREATE TABLE incident_updates (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  incident_id BIGINT UNSIGNED NOT NULL,
  update_text TEXT            NOT NULL,
  updated_by  INT UNSIGNED    NOT NULL,
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (incident_id) REFERENCES incidents(id)
);

CREATE TABLE notams (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  airport_id    INT UNSIGNED    NOT NULL,
  reference     VARCHAR(30)     NOT NULL,
  title         VARCHAR(200)    NOT NULL,
  description   TEXT,
  category      ENUM('aerodrome','navigation','communication','warning','other') NOT NULL,
  effective_from DATETIME       NOT NULL,
  effective_to  DATETIME,
  status        ENUM('active','expired','cancelled') NOT NULL DEFAULT 'active',
  created_at    DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (airport_id) REFERENCES airports(id),
  KEY idx_airport_active (airport_id, status, effective_from)
);

CREATE TABLE alerts (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  airport_id      INT UNSIGNED    NOT NULL,
  type            VARCHAR(50)     NOT NULL,
  severity        ENUM('info','warning','critical') NOT NULL DEFAULT 'info',
  message         TEXT            NOT NULL,
  flight_id       BIGINT UNSIGNED,
  auto_generated  TINYINT(1)      NOT NULL DEFAULT 1,
  acknowledged_by INT UNSIGNED,
  acknowledged_at DATETIME,
  expires_at      DATETIME,
  created_at      DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (airport_id) REFERENCES airports(id),
  FOREIGN KEY (flight_id) REFERENCES flights(id),
  KEY idx_airport_unacknowledged (airport_id, acknowledged_at)
);

-- ============================================================
-- STAFF & NOTES
-- ============================================================

CREATE TABLE staff (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  keycloak_user_id  VARCHAR(36)  NOT NULL UNIQUE,  -- UUID from Keycloak
  full_name         VARCHAR(100) NOT NULL,
  role              ENUM('controller','supervisor','manager','admin') NOT NULL,
  airport_id        INT UNSIGNED NOT NULL,
  created_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (airport_id) REFERENCES airports(id)
);

CREATE TABLE operational_notes (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  airport_id  INT UNSIGNED    NOT NULL,
  flight_id   BIGINT UNSIGNED,
  incident_id BIGINT UNSIGNED,
  note_text   TEXT            NOT NULL,
  created_by  INT UNSIGNED    NOT NULL,
  created_at  DATETIME        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (airport_id) REFERENCES airports(id),
  FOREIGN KEY (flight_id) REFERENCES flights(id),
  FOREIGN KEY (incident_id) REFERENCES incidents(id),
  FOREIGN KEY (created_by) REFERENCES staff(id)
);
