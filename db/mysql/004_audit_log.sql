-- 004_audit_log.sql — Audit log table for tracking all mutations
USE webapp_db;

CREATE TABLE IF NOT EXISTS audit_log (
  id          BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     VARCHAR(100) NOT NULL,
  username    VARCHAR(100) NOT NULL,
  action      VARCHAR(80)  NOT NULL,
  entity_type VARCHAR(50)  NOT NULL,
  entity_id   INT UNSIGNED,
  description TEXT,
  ip_address  VARCHAR(45),
  created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_created_at  (created_at),
  INDEX idx_entity      (entity_type, entity_id),
  INDEX idx_user        (username)
);
