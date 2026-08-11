-- ZГТ: личные телефоны и носители/пропуска.
-- person_id → people.id (единый реестр Расхода).

CREATE TABLE IF NOT EXISTS phones (
  id text PRIMARY KEY,
  person_id text NOT NULL REFERENCES people(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  brand text,
  model text NOT NULL,
  color text,
  imei1 text,
  imei2 text,
  serial_number text,
  has_camera boolean NOT NULL DEFAULT false,
  has_voice_recorder boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'checked_out',
  storage_cell text,
  checked_in_at timestamptz,
  checked_out_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_by text REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT chk_phones_status CHECK (status IN ('checked_in', 'checked_out'))
);

CREATE INDEX IF NOT EXISTS idx_phones_person ON phones (person_id) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_phones_status ON phones (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_phones_model ON phones (model) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS storage_items (
  id text PRIMARY KEY,
  type text NOT NULL,
  inventory_number text,
  serial_number text,
  capacity_gb integer,
  access_level integer,
  status text NOT NULL DEFAULT 'stock',
  person_id text REFERENCES people(id) ON DELETE SET NULL ON UPDATE CASCADE,
  issued_at timestamptz,
  returned_at timestamptz,
  notes text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz,
  created_by text REFERENCES users(id) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT chk_storage_items_type CHECK (type IN ('flash_drive', 'electronic_pass')),
  CONSTRAINT chk_storage_items_status CHECK (status IN ('in_use', 'stock', 'broken', 'lost'))
);

CREATE INDEX IF NOT EXISTS idx_storage_items_type ON storage_items (type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_storage_items_status ON storage_items (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_storage_items_person ON storage_items (person_id) WHERE deleted_at IS NULL;
