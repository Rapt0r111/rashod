CREATE INDEX IF NOT EXISTS idx_people_sort_name
  ON people(sort_order, name);

CREATE INDEX IF NOT EXISTS idx_group_assignments_group_date_created
  ON group_assignments(group_id, assigned_date, created_at);

CREATE INDEX IF NOT EXISTS idx_group_exclusions_group_created
  ON group_exclusions(group_id, created_at);
