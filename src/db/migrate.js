const { getDb } = require('./connection');
const logger = require('../utils/logger');

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            TEXT PRIMARY KEY,
  email         TEXT NOT NULL UNIQUE,
  password_hash TEXT,
  name          TEXT,
  role          TEXT NOT NULL DEFAULT 'user',
  mfa_secret    TEXT,
  mfa_enabled   INTEGER NOT NULL DEFAULT 0,
  is_active     INTEGER NOT NULL DEFAULT 1,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  token_hash    TEXT NOT NULL,
  expires_at    TEXT NOT NULL,
  revoked       INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS passwordless_tokens (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  code          TEXT NOT NULL,
  type          TEXT NOT NULL DEFAULT 'login',  -- 'login' | 'reset'
  expires_at    TEXT NOT NULL,
  used          INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS pa_gates (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL,
  operation     TEXT NOT NULL,          -- e.g. 'delete_account', 'transfer_funds', 'admin_action'
  status        TEXT NOT NULL DEFAULT 'pending',  -- 'pending' | 'approved' | 'denied'
  metadata      TEXT,                   -- JSON string with extra context
  requested_at  TEXT NOT NULL DEFAULT (datetime('now')),
  reviewed_by   TEXT,
  reviewed_at   TEXT,
  notes         TEXT,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);
`;

function runMigrations() {
  const db = getDb();
  logger.info('Running database migrations...');
  db.exec(SCHEMA);
  logger.info('Database migrations complete.');
}

module.exports = { runMigrations, SCHEMA };
