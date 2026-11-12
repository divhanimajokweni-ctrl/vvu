-- mini-services/safegrid/src/db/migrations/0001_init.sql
-- Migration 0001 — SafeGrid initial schema (Round 57).
--
-- Adds both tables with all columns and constraints required by the
-- ordering-integration spec (§2 SafeGrid side, §6.10). Idempotent
-- (IF NOT EXISTS) so a fresh boot converges on any prior partial state.
--
-- Evidence tags: table shapes + indexes = SPEC (the task contract);
-- SQLite dialect mapping of bigserial/timestamptz/enum = DISCLOSED
-- deviation (no Postgres in this sandbox — see schema.ts header).
-- No `sequence` column exists in this schema. Nothing here claims order.

CREATE TABLE IF NOT EXISTS safegrid_decision (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT, -- local insertion order. Diagnostic only. Not authoritative for chain order.
  alert_id             TEXT NOT NULL,
  tenant_id            TEXT NOT NULL,
  camera_id            TEXT NOT NULL,
  risk                 TEXT NOT NULL CHECK (risk IN ('low', 'high', 'unknown')),
  decision             TEXT NOT NULL CHECK (decision IN ('suppress', 'hold', 'escalate')),
  policy_epoch         INTEGER,                            -- NULL = policy missing at decision time (fail closed)
  policy_freshness     TEXT NOT NULL CHECK (policy_freshness IN ('fresh', 'stale', 'missing')),
  local_consent_valid  INTEGER NOT NULL CHECK (local_consent_valid IN (0, 1)),
  local_ceiling_allows INTEGER NOT NULL CHECK (local_ceiling_allows IN (0, 1)),
  vvu_state            TEXT NOT NULL CHECK (vvu_state IN ('healthy', 'degraded', 'unavailable')),
  backlog_depth        INTEGER NOT NULL DEFAULT 0,
  backlog_ceiling      INTEGER NOT NULL DEFAULT 0,
  decided_at           TEXT NOT NULL                        -- informational only. NOT an ordering fact.
);

CREATE INDEX IF NOT EXISTS ix_decision_tenant_decided ON safegrid_decision (tenant_id, decided_at);
CREATE INDEX IF NOT EXISTS ix_decision_decision       ON safegrid_decision (decision);

CREATE TABLE IF NOT EXISTS integration_outbox (
  id            TEXT PRIMARY KEY,                            -- uuid; identity only, no ordering meaning
  event_id      TEXT NOT NULL,
  event_type    TEXT NOT NULL,
  payload       TEXT NOT NULL,                               -- JSON. Contract: NO sequence field, ever.
  state         TEXT NOT NULL DEFAULT 'pending' CHECK (state IN ('pending', 'processing', 'delivered', 'failed')),
  available_at  TEXT NOT NULL,                               -- informational/lease arithmetic (not ordering)
  lease_until   TEXT,                                       -- claim lease expiry; NULL when unclaimed
  attempts      INTEGER NOT NULL DEFAULT 0,
  last_error    TEXT,
  delivered_at  TEXT,                                        -- informational (not ordering)
  created_at    TEXT NOT NULL                                -- informational (not ordering)
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_outbox_event_id      ON integration_outbox (event_id);
CREATE INDEX        IF NOT EXISTS ix_outbox_state_available ON integration_outbox (state, available_at);
