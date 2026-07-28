CREATE TABLE IF NOT EXISTS tasks (
  id text PRIMARY KEY,
  parent_id text REFERENCES tasks(id) ON UPDATE CASCADE ON DELETE RESTRICT,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  sort_order bigint NOT NULL,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tasks_parent ON tasks(parent_id);
CREATE INDEX IF NOT EXISTS idx_tasks_active ON tasks(completed_at, sort_order);
