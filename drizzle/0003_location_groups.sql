CREATE TABLE IF NOT EXISTS location_groups (
  id text PRIMARY KEY,
  label text NOT NULL,
  color_token text NOT NULL DEFAULT 'cyan',
  enabled boolean NOT NULL DEFAULT true,
  sort_order bigint NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS location_group_members (
  group_id text NOT NULL REFERENCES location_groups(id) ON UPDATE CASCADE ON DELETE CASCADE,
  location_key text NOT NULL,
  member_order integer NOT NULL DEFAULT 0,
  PRIMARY KEY (group_id, location_key)
);

CREATE INDEX IF NOT EXISTS idx_location_group_members_group
  ON location_group_members(group_id, member_order);
