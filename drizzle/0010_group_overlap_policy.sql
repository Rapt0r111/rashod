ALTER TABLE group_rules
  ADD COLUMN IF NOT EXISTS overlap_policy text NOT NULL DEFAULT 'exclusive';

ALTER TABLE group_rules
  DROP CONSTRAINT IF EXISTS chk_group_rules_overlap_policy;

ALTER TABLE group_rules
  ADD CONSTRAINT chk_group_rules_overlap_policy
  CHECK (overlap_policy IN ('exclusive', 'manual'));

-- Keep one deterministic assignment for legacy duplicate person-days.
-- Manual assignments win over automatic ones; the oldest assignment wins next.
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY person_id, assigned_date
      ORDER BY CASE source WHEN 'manual' THEN 0 ELSE 1 END, created_at, id
    ) AS duplicate_rank
  FROM group_assignments
)
DELETE FROM group_assignments ga
USING ranked
WHERE ga.id = ranked.id
  AND ranked.duplicate_rank > 1;

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'group_assignments'::regclass
      AND pg_get_constraintdef(oid) LIKE '%conflict_state%'
  LOOP
    EXECUTE format('ALTER TABLE group_assignments DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE group_assignments
  ADD CONSTRAINT chk_group_assignments_conflict_state
  CHECK (conflict_state IN ('clear', 'warning', 'allowed'));
