WITH ranked_members AS (
  SELECT
    members.group_id,
    members.location_key,
    ROW_NUMBER() OVER (
      PARTITION BY members.location_key
      ORDER BY groups.sort_order, groups.created_at, groups.id
    ) AS duplicate_rank
  FROM location_group_members AS members
  JOIN location_groups AS groups ON groups.id = members.group_id
)
DELETE FROM location_group_members AS members
USING ranked_members
WHERE members.group_id = ranked_members.group_id
  AND members.location_key = ranked_members.location_key
  AND ranked_members.duplicate_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_location_group_members_location
  ON location_group_members(location_key);

CREATE TABLE IF NOT EXISTS overview_settings (
  id text PRIMARY KEY,
  config jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
