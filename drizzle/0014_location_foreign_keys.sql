-- Orphan location keys cannot satisfy a foreign key. Park them on rota if it exists.
UPDATE people
SET location = 'rota'
WHERE location NOT IN (SELECT key FROM locations)
  AND EXISTS (SELECT 1 FROM locations WHERE key = 'rota');

DELETE FROM location_group_members
WHERE location_key NOT IN (SELECT key FROM locations);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'people_location_fkey'
  ) THEN
    ALTER TABLE people
      ADD CONSTRAINT people_location_fkey
      FOREIGN KEY (location) REFERENCES locations(key)
      ON UPDATE CASCADE ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'location_group_members_location_fkey'
  ) THEN
    ALTER TABLE location_group_members
      ADD CONSTRAINT location_group_members_location_fkey
      FOREIGN KEY (location_key) REFERENCES locations(key)
      ON UPDATE CASCADE ON DELETE CASCADE;
  END IF;
END $$;
