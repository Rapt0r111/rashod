import fs from "node:fs";
import path from "node:path";
import postgres, { type Sql, type TransactionSql } from "postgres";

export const POSTGRES_MIGRATIONS = [
  "0000_initial_postgres.sql",
  "0001_security_hardening.sql",
  "0002_tasks.sql",
  "0003_location_groups.sql",
  "0004_overview_settings_and_unique_location_groups.sql",
  "0005_data_integrity_normalization.sql",
  "0006_person_conscription_number.sql",
  "0007_performance_indexes.sql",
  "0008_location_counts_as_present.sql",
  "0009_group_assignment_quotas.sql",
  "0010_group_overlap_policy.sql",
  "0011_zgt_personnel_and_equipment.sql",
  "0012_zgt_phones_and_storage_items.sql",
] as const;

type MigrationName = (typeof POSTGRES_MIGRATIONS)[number];
type SqlExecutor = Sql | TransactionSql;

const REQUIRED_SCHEMA: Record<string, readonly string[]> = {
  platoons: ["id", "key", "label", "sort_order", "is_system"],
  locations: ["id", "key", "label", "color_token", "is_quick", "quick_code", "is_system", "sort_order", "counts_as_present"],
  people: ["id", "platoon_id", "rank", "name", "conscription_number", "location", "sort_order", "created_at", "updated_at"],
  movement_logs: ["id", "person_id", "name", "from_value", "to_value", "occurred_at"],
  group_templates: ["id", "key", "name", "color_token", "icon", "default_people_per_day", "default_active_days", "sort_order", "is_system", "created_at"],
  duty_groups: ["id", "template_id", "name", "notes", "enabled", "sort_order", "created_at", "updated_at"],
  group_rules: ["id", "group_id", "enabled_platoons", "people_per_day", "assignment_quotas", "auto_rotate", "active_days", "priority_mode", "overlap_policy"],
  group_assignments: ["id", "group_id", "person_id", "assigned_date", "source", "conflict_state", "created_at"],
  group_exclusions: ["id", "group_id", "person_id", "day_of_week", "reason", "created_at"],
  users: ["id", "username", "password_hash", "display_name", "active", "session_version", "created_at", "updated_at"],
  roles: ["id", "key", "name", "description", "is_system", "created_at"],
  permissions: ["key", "label", "description"],
  user_roles: ["user_id", "role_id"],
  role_permissions: ["role_id", "permission_key"],
  sessions: ["token_hash", "user_id", "session_version", "expires_at", "created_at"],
  tasks: ["id", "parent_id", "title", "description", "sort_order", "completed_at", "created_at", "updated_at"],
  location_groups: ["id", "label", "color_token", "enabled", "sort_order", "created_at", "updated_at"],
  location_group_members: ["group_id", "location_key", "member_order"],
  overview_settings: ["id", "config", "updated_at"],
  personnel_profiles: [
    "person_id",
    "last_name",
    "first_name",
    "middle_name",
    "position",
    "unit",
    "notes",
    "created_at",
    "updated_at",
  ],
  equipment: [
    "id",
    "category",
    "device_type",
    "is_personal",
    "display_name",
    "inventory_number",
    "serial_number",
    "mni_serial_number",
    "manufacturer",
    "model",
    "cpu",
    "ram_gb",
    "storage_type",
    "storage_gb",
    "os",
    "has_charger",
    "has_mouse",
    "has_bag",
    "is_charger_working",
    "is_mouse_working",
    "is_working",
    "person_id",
    "location",
    "status",
    "created_at",
    "updated_at",
    "deleted_at",
    "created_by",
  ],
  storage_devices: [
    "id",
    "equipment_id",
    "manufacturer",
    "model",
    "inventory_number",
    "serial_number",
    "capacity_gb",
    "interface",
    "type",
    "created_at",
    "updated_at",
    "deleted_at",
  ],
  equipment_transfers: [
    "id",
    "equipment_id",
    "type",
    "from_person_id",
    "to_person_id",
    "from_location",
    "to_location",
    "document_ref",
    "notes",
    "transferred_at",
    "created_by",
  ],
  phones: [
    "id",
    "person_id",
    "brand",
    "model",
    "color",
    "imei1",
    "imei2",
    "serial_number",
    "has_camera",
    "has_voice_recorder",
    "status",
    "storage_cell",
    "checked_in_at",
    "checked_out_at",
    "created_at",
    "updated_at",
    "deleted_at",
    "created_by",
  ],
  storage_items: [
    "id",
    "type",
    "inventory_number",
    "serial_number",
    "capacity_gb",
    "access_level",
    "status",
    "person_id",
    "issued_at",
    "returned_at",
    "notes",
    "created_at",
    "updated_at",
    "deleted_at",
    "created_by",
  ],
};
const POST_INITIAL_TABLES = new Set([
  "tasks",
  "location_groups",
  "location_group_members",
  "overview_settings",
  "personnel_profiles",
  "equipment",
  "storage_devices",
  "equipment_transfers",
  "phones",
  "storage_items",
]);
const INITIAL_SCHEMA = Object.fromEntries(
  Object.entries(REQUIRED_SCHEMA)
    .filter(([table]) => !POST_INITIAL_TABLES.has(table))
    .map(([table, columns]) => [
      table,
      table === "people"
        ? columns.filter((column) => column !== "conscription_number")
        : table === "locations"
          ? columns.filter((column) => column !== "counts_as_present")
          : table === "group_rules"
            ? columns.filter((column) => column !== "assignment_quotas" && column !== "overlap_policy")
            : columns,
    ]),
);
const REQUIRED_CONSTRAINTS = [
  "uq_group_assignments_person_day",
  "chk_group_templates_default_active_days_array",
  "chk_group_rules_active_days_array",
  "chk_group_rules_enabled_platoons_array",
  "chk_group_rules_assignment_quotas_array",
  "chk_group_rules_overlap_policy",
  "chk_group_assignments_conflict_state",
  "chk_overview_settings_config_object",
  "chk_equipment_category",
  "chk_equipment_device_type",
  "chk_equipment_status",
  "chk_equipment_transfers_type",
  "chk_phones_status",
  "chk_storage_items_type",
  "chk_storage_items_status",
] as const;
const REQUIRED_INDEXES = [
  "idx_people_platoon",
  "idx_people_sort_name",
  "idx_movement_logs_occurred_at",
  "idx_duty_groups_template",
  "idx_group_assignments_group_date",
  "idx_group_assignments_group_date_created",
  "idx_group_assignments_person_date",
  "idx_group_exclusions_group",
  "idx_group_exclusions_group_created",
  "uq_group_exclusions_scope",
  "idx_sessions_user",
  "idx_sessions_expires_at",
  "idx_tasks_parent",
  "idx_tasks_active",
  "idx_location_group_members_group",
  "idx_location_group_members_location",
  "idx_personnel_profiles_unit",
  "equipment_inventory_number_unique_idx",
  "idx_equipment_status",
  "idx_equipment_category",
  "idx_equipment_person",
  "idx_equipment_location",
  "idx_equipment_display_name",
  "idx_storage_devices_equipment",
  "idx_equipment_transfers_equipment",
  "idx_equipment_transfers_date",
  "idx_phones_person",
  "idx_phones_status",
  "idx_phones_model",
  "idx_storage_items_type",
  "idx_storage_items_status",
  "idx_storage_items_person",
] as const;

export function migrationPath(root: string, name: MigrationName) {
  return path.join(root, "drizzle", name);
}

async function tableExists(sql: SqlExecutor, tableName: string) {
  const rows = await sql<Array<{ tableName: string | null }>>`SELECT to_regclass(${`public.${tableName}`}::text) AS "tableName"`;
  return rows[0]?.tableName !== null;
}

export async function assertRequiredPostgresSchema(sql: SqlExecutor, requiredSchema = REQUIRED_SCHEMA) {
  const rows = await sql<Array<{ tableName: string; columnName: string }>>`
    SELECT table_name AS "tableName", column_name AS "columnName"
    FROM information_schema.columns
    WHERE table_schema = 'public'
  `;
  const columnsByTable = new Map<string, Set<string>>();
  for (const row of rows) {
    const columns = columnsByTable.get(row.tableName) ?? new Set<string>();
    columns.add(row.columnName);
    columnsByTable.set(row.tableName, columns);
  }

  const missing: string[] = [];
  for (const [table, requiredColumns] of Object.entries(requiredSchema)) {
    const columns = columnsByTable.get(table);
    if (!columns) {
      missing.push(`${table}.*`);
      continue;
    }
    for (const column of requiredColumns) if (!columns.has(column)) missing.push(`${table}.${column}`);
  }
  if (missing.length) throw new Error(`PostgreSQL schema is incomplete: ${missing.join(", ")}`);
}

export async function assertRequiredPostgresConstraints(sql: SqlExecutor) {
  const rows = await sql<Array<{ constraintName: string }>>`
    SELECT conname AS "constraintName"
    FROM pg_constraint
    WHERE connamespace = 'public'::regnamespace
  `;
  const current = new Set(rows.map((row) => row.constraintName));
  const missing = REQUIRED_CONSTRAINTS.filter((constraint) => !current.has(constraint));
  if (missing.length) throw new Error(`PostgreSQL constraints are incomplete: ${missing.join(", ")}`);
}

export async function assertRequiredPostgresIndexes(sql: SqlExecutor) {
  const rows = await sql<Array<{ indexName: string }>>`
    SELECT indexname AS "indexName"
    FROM pg_indexes
    WHERE schemaname = 'public'
  `;
  const current = new Set(rows.map((row) => row.indexName));
  const missing = REQUIRED_INDEXES.filter((index) => !current.has(index));
  if (missing.length) throw new Error(`PostgreSQL indexes are incomplete: ${missing.join(", ")}`);
}

async function markInitialIfLegacySchema(sql: SqlExecutor) {
  const hasLegacySchema = await tableExists(sql, "platoons");
  if (!hasLegacySchema) return;
  const applied = await sql<{ name: string }[]>`SELECT name FROM schema_migrations WHERE name = '0000_initial_postgres.sql'`;
  if (applied.length) return;
  await assertRequiredPostgresSchema(sql, INITIAL_SCHEMA);
  await sql`INSERT INTO schema_migrations (name) VALUES ('0000_initial_postgres.sql') ON CONFLICT DO NOTHING`;
  console.log("Marked 0000_initial_postgres.sql as already present after full schema check.");
}

export async function migratePostgres(sql: Sql, root = process.cwd()) {
  await sql.begin(async (transaction) => {
    await transaction`SELECT pg_advisory_xact_lock(hashtext('rashod-next:migrate-postgres')::bigint)`;
    await transaction`CREATE TABLE IF NOT EXISTS schema_migrations (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())`;
    await markInitialIfLegacySchema(transaction);

    for (const name of POSTGRES_MIGRATIONS) {
      const existing = await transaction<{ name: string }[]>`SELECT name FROM schema_migrations WHERE name = ${name}`;
      if (existing.length) continue;
      const file = migrationPath(root, name);
      const body = fs.readFileSync(file, "utf8");
      await transaction.unsafe(body);
      await transaction`INSERT INTO schema_migrations (name) VALUES (${name})`;
      console.log(`Applied ${name}.`);
    }
    await assertRequiredPostgresSchema(transaction);
    await assertRequiredPostgresConstraints(transaction);
    await assertRequiredPostgresIndexes(transaction);
  });
}

if (import.meta.main) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required. Refusing to migrate an unspecified database.");

  const sql = postgres(url, { max: 1 });
  try {
    await migratePostgres(sql);
  } finally {
    await sql.end({ timeout: 5 });
  }
}
