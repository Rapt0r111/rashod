-- PostgreSQL target schema. IDs intentionally remain TEXT to preserve existing
-- LAN SQLite records and API contracts during a zero-remap migration.
CREATE TABLE platoons (id text PRIMARY KEY, key text NOT NULL UNIQUE, label text NOT NULL, sort_order bigint NOT NULL, is_system boolean NOT NULL DEFAULT false);
CREATE TABLE locations (id text PRIMARY KEY, key text NOT NULL UNIQUE, label text NOT NULL, color_token text NOT NULL, is_quick boolean NOT NULL DEFAULT false, quick_code text, is_system boolean NOT NULL DEFAULT false, sort_order bigint NOT NULL);
CREATE TABLE people (id text PRIMARY KEY, platoon_id text NOT NULL REFERENCES platoons(id) ON UPDATE CASCADE ON DELETE RESTRICT, rank text NOT NULL, name text NOT NULL, conscription_number text, location text NOT NULL, sort_order bigint NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX idx_people_platoon ON people(platoon_id);
CREATE TABLE movement_logs (id text PRIMARY KEY, person_id text REFERENCES people(id) ON UPDATE CASCADE ON DELETE SET NULL, name text NOT NULL, from_value text NOT NULL, to_value text NOT NULL, occurred_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX idx_movement_logs_occurred_at ON movement_logs(occurred_at DESC);

CREATE TABLE group_templates (id text PRIMARY KEY, key text NOT NULL UNIQUE, name text NOT NULL, color_token text NOT NULL, icon text NOT NULL, default_people_per_day integer NOT NULL CHECK (default_people_per_day > 0), default_active_days jsonb NOT NULL, sort_order bigint NOT NULL, is_system boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE duty_groups (id text PRIMARY KEY, template_id text NOT NULL REFERENCES group_templates(id) ON UPDATE CASCADE ON DELETE RESTRICT, name text NOT NULL, notes text NOT NULL DEFAULT '', enabled boolean NOT NULL DEFAULT true, sort_order bigint NOT NULL, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX idx_duty_groups_template ON duty_groups(template_id);
CREATE TABLE group_rules (id text PRIMARY KEY, group_id text NOT NULL UNIQUE REFERENCES duty_groups(id) ON UPDATE CASCADE ON DELETE CASCADE, enabled_platoons jsonb NOT NULL, people_per_day integer NOT NULL CHECK (people_per_day > 0), auto_rotate boolean NOT NULL DEFAULT true, active_days jsonb NOT NULL, priority_mode text NOT NULL CHECK (priority_mode IN ('oldest', 'random')));
CREATE TABLE group_assignments (id text PRIMARY KEY, group_id text NOT NULL REFERENCES duty_groups(id) ON UPDATE CASCADE ON DELETE CASCADE, person_id text NOT NULL REFERENCES people(id) ON UPDATE CASCADE ON DELETE CASCADE, assigned_date date NOT NULL, source text NOT NULL CHECK (source IN ('auto', 'manual')), conflict_state text NOT NULL CHECK (conflict_state IN ('clear', 'warning')), created_at timestamptz NOT NULL DEFAULT now(), CONSTRAINT uq_group_assignments_person_day UNIQUE (group_id, person_id, assigned_date));
CREATE INDEX idx_group_assignments_group_date ON group_assignments(group_id, assigned_date);
CREATE INDEX idx_group_assignments_person_date ON group_assignments(person_id, assigned_date);
CREATE TABLE group_exclusions (id text PRIMARY KEY, group_id text NOT NULL REFERENCES duty_groups(id) ON UPDATE CASCADE ON DELETE CASCADE, person_id text NOT NULL REFERENCES people(id) ON UPDATE CASCADE ON DELETE CASCADE, day_of_week integer CHECK (day_of_week BETWEEN 0 AND 6), reason text NOT NULL DEFAULT '', created_at timestamptz NOT NULL DEFAULT now());
CREATE UNIQUE INDEX uq_group_exclusions_scope ON group_exclusions(group_id, person_id, COALESCE(day_of_week, -1));
CREATE INDEX idx_group_exclusions_group ON group_exclusions(group_id);

CREATE TABLE users (id text PRIMARY KEY, username text NOT NULL UNIQUE, password_hash text NOT NULL, display_name text NOT NULL, active boolean NOT NULL DEFAULT true, session_version integer NOT NULL DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE roles (id text PRIMARY KEY, key text NOT NULL UNIQUE, name text NOT NULL, description text NOT NULL DEFAULT '', is_system boolean NOT NULL DEFAULT false, created_at timestamptz NOT NULL DEFAULT now());
CREATE TABLE permissions (key text PRIMARY KEY, label text NOT NULL, description text NOT NULL DEFAULT '');
CREATE TABLE user_roles (user_id text NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE, role_id text NOT NULL REFERENCES roles(id) ON UPDATE CASCADE ON DELETE CASCADE, PRIMARY KEY (user_id, role_id));
CREATE TABLE role_permissions (role_id text NOT NULL REFERENCES roles(id) ON UPDATE CASCADE ON DELETE CASCADE, permission_key text NOT NULL REFERENCES permissions(key) ON UPDATE CASCADE ON DELETE CASCADE, PRIMARY KEY (role_id, permission_key));
CREATE TABLE sessions (token_hash text PRIMARY KEY, user_id text NOT NULL REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE, session_version integer NOT NULL DEFAULT 0, expires_at timestamptz NOT NULL, created_at timestamptz NOT NULL DEFAULT now());
CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
