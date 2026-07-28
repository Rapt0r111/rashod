CREATE OR REPLACE FUNCTION normalize_jsonb_scalar(value jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  parsed jsonb;
BEGIN
  IF jsonb_typeof(value) <> 'string' THEN
    RETURN value;
  END IF;

  BEGIN
    parsed := (value #>> '{}')::jsonb;
    RETURN parsed;
  EXCEPTION WHEN others THEN
    RETURN value;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION normalize_jsonb_int_weekdays(value jsonb, fallback jsonb DEFAULT '[0,1,2,3,4,5,6]'::jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  WITH source AS (
    SELECT normalize_jsonb_scalar(value) AS normalized
  ), items AS (
    SELECT elem.value AS raw_value
    FROM source
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(source.normalized) = 'array' THEN source.normalized ELSE '[]'::jsonb END
    ) AS elem(value)
  ), parsed AS (
    SELECT CASE
      WHEN jsonb_typeof(raw_value) = 'number' AND (raw_value #>> '{}') ~ '^\d+$' THEN (raw_value #>> '{}')::int
      WHEN jsonb_typeof(raw_value) = 'string' AND (raw_value #>> '{}') ~ '^\d+$' THEN (raw_value #>> '{}')::int
      ELSE NULL
    END AS day
    FROM items
  ), valid AS (
    SELECT DISTINCT day FROM parsed WHERE day BETWEEN 0 AND 6
  ), aggregated AS (
    SELECT jsonb_agg(day ORDER BY day) AS days FROM valid
  )
  SELECT COALESCE((SELECT days FROM aggregated), fallback);
$$;

CREATE OR REPLACE FUNCTION normalize_jsonb_text_array(value jsonb)
RETURNS jsonb
LANGUAGE sql
IMMUTABLE
AS $$
  WITH source AS (
    SELECT normalize_jsonb_scalar(value) AS normalized
  ), items AS (
    SELECT DISTINCT btrim(elem.value #>> '{}') AS item
    FROM source
    CROSS JOIN LATERAL jsonb_array_elements(
      CASE WHEN jsonb_typeof(source.normalized) = 'array' THEN source.normalized ELSE '[]'::jsonb END
    ) AS elem(value)
    WHERE jsonb_typeof(elem.value) = 'string' AND btrim(elem.value #>> '{}') <> ''
  )
  SELECT COALESCE(jsonb_agg(item ORDER BY item), '[]'::jsonb) FROM items;
$$;

UPDATE group_templates
SET default_active_days = normalize_jsonb_int_weekdays(default_active_days)
WHERE jsonb_typeof(default_active_days) <> 'array'
   OR default_active_days <> normalize_jsonb_int_weekdays(default_active_days);

UPDATE group_rules
SET active_days = normalize_jsonb_int_weekdays(active_days),
    enabled_platoons = normalize_jsonb_text_array(enabled_platoons)
WHERE jsonb_typeof(active_days) <> 'array'
   OR active_days <> normalize_jsonb_int_weekdays(active_days)
   OR jsonb_typeof(enabled_platoons) <> 'array'
   OR enabled_platoons <> normalize_jsonb_text_array(enabled_platoons);

UPDATE overview_settings
SET config = CASE
  WHEN jsonb_typeof(normalize_jsonb_scalar(config)) = 'object' THEN normalize_jsonb_scalar(config)
  ELSE '{}'::jsonb
END,
updated_at = now()
WHERE jsonb_typeof(config) <> 'object';

WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY group_id, person_id, assigned_date
      ORDER BY CASE source WHEN 'manual' THEN 0 ELSE 1 END, created_at, id
    ) AS duplicate_rank
  FROM group_assignments
)
DELETE FROM group_assignments AS assignments
USING ranked
WHERE assignments.id = ranked.id
  AND ranked.duplicate_rank > 1;

CREATE UNIQUE INDEX IF NOT EXISTS uq_group_assignments_person_day
  ON group_assignments(group_id, person_id, assigned_date);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'uq_group_assignments_person_day') THEN
    ALTER TABLE group_assignments
      ADD CONSTRAINT uq_group_assignments_person_day
      UNIQUE USING INDEX uq_group_assignments_person_day;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_group_templates_default_active_days_array') THEN
    ALTER TABLE group_templates
      ADD CONSTRAINT chk_group_templates_default_active_days_array
      CHECK (jsonb_typeof(default_active_days) = 'array');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_group_rules_active_days_array') THEN
    ALTER TABLE group_rules
      ADD CONSTRAINT chk_group_rules_active_days_array
      CHECK (jsonb_typeof(active_days) = 'array');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_group_rules_enabled_platoons_array') THEN
    ALTER TABLE group_rules
      ADD CONSTRAINT chk_group_rules_enabled_platoons_array
      CHECK (jsonb_typeof(enabled_platoons) = 'array');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_overview_settings_config_object') THEN
    ALTER TABLE overview_settings
      ADD CONSTRAINT chk_overview_settings_config_object
      CHECK (jsonb_typeof(config) = 'object');
  END IF;
END
$$;

DROP FUNCTION normalize_jsonb_text_array(jsonb);
DROP FUNCTION normalize_jsonb_int_weekdays(jsonb, jsonb);
DROP FUNCTION normalize_jsonb_scalar(jsonb);
