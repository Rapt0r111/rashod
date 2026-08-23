-- Typed "Другое" places live on people.location only. They must not require a
-- locations catalog row. Group membership stays catalog-only.
ALTER TABLE people DROP CONSTRAINT IF EXISTS people_location_fkey;
