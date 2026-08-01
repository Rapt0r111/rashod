ALTER TABLE group_rules
  ADD COLUMN IF NOT EXISTS assignment_quotas jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE group_rules
  DROP CONSTRAINT IF EXISTS chk_group_rules_assignment_quotas_array;

ALTER TABLE group_rules
  ADD CONSTRAINT chk_group_rules_assignment_quotas_array
  CHECK (jsonb_typeof(assignment_quotas) = 'array');
