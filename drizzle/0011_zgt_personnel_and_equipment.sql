-- Module ЗГТ: personnel profiles (1:1 people) + equipment domain.
-- people remains the source of truth; equipment.person_id → people.id (text).
-- Person status is people.location only (no zgt_status).

CREATE TABLE IF NOT EXISTS personnel_profiles (
  person_id text PRIMARY KEY REFERENCES people(id) ON DELETE CASCADE ON UPDATE CASCADE,
  last_name text,
  first_name text,
  middle_name text,
  position text,
  unit text,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_personnel_profiles_unit ON personnel_profiles (unit);

CREATE TABLE IF NOT EXISTS equipment (
  id text PRIMARY KEY,
  category text NOT NULL,
  device_type text NOT NULL DEFAULT 'other',
  is_personal boolean NOT NULL DEFAULT false,
  display_name text NOT NULL,
  inventory_number text,
  serial_number text,
  mni_serial_number text,
  manufacturer text,
  model text,
  cpu text,
  ram_gb integer,
  storage_type text,
  storage_gb integer,
  os text,
  has_charger boolean,
  has_mouse boolean,
  has_bag boolean,
  is_charger_working boolean,
  is_mouse_working boolean,
  is_working boolean NOT NULL DEFAULT true,
  person_id text REFERENCES people(id) ON DELETE SET NULL ON UPDATE CASCADE,
  location text,
  status text NOT NULL DEFAULT 'storage',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_by text REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT chk_equipment_category
    CHECK (category IN ('workstation', 'laptop', 'server', 'other')),
  CONSTRAINT chk_equipment_device_type
    CHECK (device_type IN ('pevm', 'arm', 'laptop', 'server', 'other')),
  CONSTRAINT chk_equipment_status
    CHECK (status IN ('in_use', 'storage', 'repair', 'broken'))
);

CREATE UNIQUE INDEX IF NOT EXISTS equipment_inventory_number_unique_idx
  ON equipment (inventory_number)
  WHERE inventory_number IS NOT NULL AND deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_equipment_status ON equipment (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_equipment_category ON equipment (category) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_equipment_person ON equipment (person_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_equipment_location ON equipment (location) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_equipment_display_name ON equipment (display_name) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS storage_devices (
  id text PRIMARY KEY,
  equipment_id text NOT NULL REFERENCES equipment(id) ON DELETE CASCADE ON UPDATE CASCADE,
  manufacturer text,
  model text,
  inventory_number text,
  serial_number text NOT NULL DEFAULT '',
  capacity_gb integer NOT NULL DEFAULT 0,
  interface text,
  type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_storage_devices_equipment
  ON storage_devices (equipment_id)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS equipment_transfers (
  id text PRIMARY KEY,
  equipment_id text NOT NULL REFERENCES equipment(id) ON DELETE CASCADE ON UPDATE CASCADE,
  type text NOT NULL,
  from_person_id text REFERENCES people(id) ON DELETE SET NULL ON UPDATE CASCADE,
  to_person_id text REFERENCES people(id) ON DELETE SET NULL ON UPDATE CASCADE,
  from_location text,
  to_location text,
  document_ref text,
  notes text,
  transferred_at timestamptz NOT NULL DEFAULT now(),
  created_by text REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT chk_equipment_transfers_type
    CHECK (type IN ('issued', 'returned', 'sent_repair', 'returned_repair', 'written_off'))
);

CREATE INDEX IF NOT EXISTS idx_equipment_transfers_equipment ON equipment_transfers (equipment_id);
CREATE INDEX IF NOT EXISTS idx_equipment_transfers_date ON equipment_transfers (transferred_at DESC);
