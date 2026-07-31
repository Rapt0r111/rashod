ALTER TABLE locations
  ADD COLUMN IF NOT EXISTS counts_as_present boolean NOT NULL DEFAULT false;

UPDATE locations
SET counts_as_present = true
WHERE key = 'rota';
