-- Align phones.person_id with equipment/storage: survive person delete.
ALTER TABLE phones ALTER COLUMN person_id DROP NOT NULL;

DO $$
DECLARE
  constraint_name text;
BEGIN
  FOR constraint_name IN
    SELECT conname
    FROM pg_constraint
    WHERE conrelid = 'phones'::regclass
      AND contype = 'f'
      AND pg_get_constraintdef(oid) LIKE '%person_id%'
  LOOP
    EXECUTE format('ALTER TABLE phones DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;

ALTER TABLE phones
  ADD CONSTRAINT phones_person_id_fkey
  FOREIGN KEY (person_id) REFERENCES people(id)
  ON UPDATE CASCADE ON DELETE SET NULL;
