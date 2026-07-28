ALTER TABLE users ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0;
ALTER TABLE sessions ADD COLUMN IF NOT EXISTS session_version integer NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS login_rate_limits (
  key text PRIMARY KEY,
  attempt_count integer NOT NULL DEFAULT 0,
  window_started_at timestamptz NOT NULL DEFAULT now(),
  blocked_until timestamptz
);

CREATE TABLE IF NOT EXISTS auth_audit_events (
  id text PRIMARY KEY,
  action text NOT NULL,
  actor_user_id text REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  target_user_id text REFERENCES users(id) ON UPDATE CASCADE ON DELETE SET NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_auth_audit_events_occurred_at ON auth_audit_events(occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_auth_audit_events_target ON auth_audit_events(target_user_id, occurred_at DESC);
