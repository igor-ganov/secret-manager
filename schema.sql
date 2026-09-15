CREATE TABLE IF NOT EXISTS secrets (
  user_id INTEGER NOT NULL,
  key TEXT NOT NULL,
  value TEXT NOT NULL,
  PRIMARY KEY (user_id, key)
);

CREATE TABLE IF NOT EXISTS one_time_links (
  token TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS pending_sets (
  user_id INTEGER PRIMARY KEY,
  key TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_settings (
  user_id INTEGER PRIMARY KEY,
  link_ttl_minutes INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS api_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL,
  label TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS api_tokens_user ON api_tokens (user_id);

CREATE TABLE IF NOT EXISTS accounts (
  account_id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  user_handle TEXT NOT NULL UNIQUE,
  recovery_hash TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS passkeys (
  credential_id TEXT PRIMARY KEY,
  account_id INTEGER NOT NULL,
  public_key TEXT NOT NULL,
  counter INTEGER NOT NULL,
  transports TEXT NOT NULL,
  backed_up INTEGER NOT NULL,
  label TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS passkeys_account ON passkeys (account_id);

CREATE TABLE IF NOT EXISTS challenges (
  challenge TEXT PRIMARY KEY,
  flow TEXT NOT NULL,
  account_id INTEGER,
  payload TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS enrollments (
  code_hash TEXT PRIMARY KEY,
  account_id INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);

-- Replaced by device_requests (SQLite cannot add columns idempotently;
-- requests live ten minutes, so nothing is lost).
DROP TABLE IF EXISTS login_requests;

CREATE TABLE IF NOT EXISTS device_requests (
  code_hash TEXT PRIMARY KEY,
  poll_hash TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL,
  label TEXT NOT NULL,
  subject TEXT NOT NULL,
  callback TEXT NOT NULL,
  status TEXT NOT NULL,
  account_id INTEGER NOT NULL,
  issued_token TEXT NOT NULL,
  grant_code TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS telegram_links (
  telegram_user_id INTEGER PRIMARY KEY,
  account_id INTEGER NOT NULL,
  linked_at INTEGER NOT NULL
);
