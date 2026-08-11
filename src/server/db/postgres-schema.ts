import {
  boolean,
  bigint,
  check,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  timestamp,
  type AnyPgColumn,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Existing SQLite identifiers are stable text keys (not UUIDs). Keep them during
// migration so foreign keys remain valid and clients do not need an ID remap.
const id = (name = "id") => text(name).primaryKey();
const createdAt = (name = "created_at") => timestamp(name, { withTimezone: true }).defaultNow().notNull();

export const platoons = pgTable("platoons", {
  id: id(), key: text("key").notNull().unique(), label: text("label").notNull(),
  sortOrder: bigint("sort_order", { mode: "number" }).notNull(), isSystem: boolean("is_system").notNull().default(false),
});
export const locations = pgTable("locations", {
  id: id(), key: text("key").notNull().unique(), label: text("label").notNull(), colorToken: text("color_token").notNull(),
  isQuick: boolean("is_quick").notNull().default(false), quickCode: text("quick_code"), isSystem: boolean("is_system").notNull().default(false),
  countsAsPresent: boolean("counts_as_present").notNull().default(false), sortOrder: bigint("sort_order", { mode: "number" }).notNull(),
});
export const locationGroups = pgTable("location_groups", {
  id: id(), label: text("label").notNull(), colorToken: text("color_token").notNull(), enabled: boolean("enabled").notNull().default(true), sortOrder: bigint("sort_order", { mode: "number" }).notNull(), createdAt: createdAt(), updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
export const locationGroupMembers = pgTable("location_group_members", {
  groupId: text("group_id").notNull().references(() => locationGroups.id, { onDelete: "cascade", onUpdate: "cascade" }), locationKey: text("location_key").notNull(), memberOrder: integer("member_order").notNull().default(0),
}, (table) => [primaryKey({ columns: [table.groupId, table.locationKey] }), index("idx_location_group_members_group").on(table.groupId), uniqueIndex("idx_location_group_members_location").on(table.locationKey)]);
export const overviewSettings = pgTable("overview_settings", {
  id: id(), config: jsonb("config").notNull(), updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [check("chk_overview_settings_config_object", sql`jsonb_typeof(${table.config}) = 'object'`)]);
export const people = pgTable("people", {
  id: id(), platoonId: text("platoon_id").notNull().references(() => platoons.id, { onDelete: "restrict", onUpdate: "cascade" }),
  rank: text("rank").notNull(), name: text("name").notNull(), conscriptionNumber: text("conscription_number"), location: text("location").notNull(), sortOrder: bigint("sort_order", { mode: "number" }).notNull(),
  createdAt: createdAt(), updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("idx_people_platoon").on(table.platoonId), index("idx_people_sort_name").on(table.sortOrder, table.name)]);
/** ZГТ extension of a person — not a second master registry. Status = people.location. */
export const personnelProfiles = pgTable("personnel_profiles", {
  personId: text("person_id").primaryKey().references(() => people.id, { onDelete: "cascade", onUpdate: "cascade" }),
  lastName: text("last_name"),
  firstName: text("first_name"),
  middleName: text("middle_name"),
  position: text("position"),
  unit: text("unit"),
  notes: text("notes").notNull().default(""),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("idx_personnel_profiles_unit").on(table.unit)]);
export const equipment = pgTable("equipment", {
  id: id(),
  category: text("category").notNull(),
  deviceType: text("device_type").notNull().default("other"),
  isPersonal: boolean("is_personal").notNull().default(false),
  displayName: text("display_name").notNull(),
  inventoryNumber: text("inventory_number"),
  serialNumber: text("serial_number"),
  mniSerialNumber: text("mni_serial_number"),
  manufacturer: text("manufacturer"),
  model: text("model"),
  cpu: text("cpu"),
  ramGb: integer("ram_gb"),
  storageType: text("storage_type"),
  storageGb: integer("storage_gb"),
  os: text("os"),
  hasCharger: boolean("has_charger"),
  hasMouse: boolean("has_mouse"),
  hasBag: boolean("has_bag"),
  isChargerWorking: boolean("is_charger_working"),
  isMouseWorking: boolean("is_mouse_working"),
  isWorking: boolean("is_working").notNull().default(true),
  personId: text("person_id").references(() => people.id, { onDelete: "set null", onUpdate: "cascade" }),
  location: text("location"),
  status: text("status").notNull().default("storage"),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdBy: text("created_by").references((): AnyPgColumn => users.id, { onDelete: "set null", onUpdate: "cascade" }),
}, (table) => [
  index("idx_equipment_status").on(table.status),
  index("idx_equipment_category").on(table.category),
  index("idx_equipment_person").on(table.personId),
  uniqueIndex("equipment_inventory_number_unique_idx").on(table.inventoryNumber),
  check("chk_equipment_category", sql`${table.category} IN ('workstation', 'laptop', 'server', 'other')`),
  check("chk_equipment_device_type", sql`${table.deviceType} IN ('pevm', 'arm', 'laptop', 'server', 'other')`),
  check("chk_equipment_status", sql`${table.status} IN ('in_use', 'storage', 'repair', 'broken')`),
]);
export const storageDevices = pgTable("storage_devices", {
  id: id(),
  equipmentId: text("equipment_id").notNull().references(() => equipment.id, { onDelete: "cascade", onUpdate: "cascade" }),
  manufacturer: text("manufacturer"),
  model: text("model"),
  inventoryNumber: text("inventory_number"),
  serialNumber: text("serial_number").notNull().default(""),
  capacityGb: integer("capacity_gb").notNull().default(0),
  interface: text("interface"),
  type: text("type"),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
}, (table) => [index("idx_storage_devices_equipment").on(table.equipmentId)]);
export const equipmentTransfers = pgTable("equipment_transfers", {
  id: id(),
  equipmentId: text("equipment_id").notNull().references(() => equipment.id, { onDelete: "cascade", onUpdate: "cascade" }),
  type: text("type").notNull(),
  fromPersonId: text("from_person_id").references(() => people.id, { onDelete: "set null", onUpdate: "cascade" }),
  toPersonId: text("to_person_id").references(() => people.id, { onDelete: "set null", onUpdate: "cascade" }),
  fromLocation: text("from_location"),
  toLocation: text("to_location"),
  documentRef: text("document_ref"),
  notes: text("notes"),
  transferredAt: timestamp("transferred_at", { withTimezone: true }).defaultNow().notNull(),
  createdBy: text("created_by").references((): AnyPgColumn => users.id, { onDelete: "set null", onUpdate: "cascade" }),
}, (table) => [
  index("idx_equipment_transfers_equipment").on(table.equipmentId),
  index("idx_equipment_transfers_date").on(table.transferredAt),
  check("chk_equipment_transfers_type", sql`${table.type} IN ('issued', 'returned', 'sent_repair', 'returned_repair', 'written_off')`),
]);
export const phones = pgTable("phones", {
  id: id(),
  personId: text("person_id").notNull().references(() => people.id, { onDelete: "restrict", onUpdate: "cascade" }),
  brand: text("brand"),
  model: text("model").notNull(),
  color: text("color"),
  imei1: text("imei1"),
  imei2: text("imei2"),
  serialNumber: text("serial_number"),
  hasCamera: boolean("has_camera").notNull().default(false),
  hasVoiceRecorder: boolean("has_voice_recorder").notNull().default(false),
  status: text("status").notNull().default("checked_out"),
  storageCell: text("storage_cell"),
  checkedInAt: timestamp("checked_in_at", { withTimezone: true }),
  checkedOutAt: timestamp("checked_out_at", { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdBy: text("created_by").references((): AnyPgColumn => users.id, { onDelete: "set null", onUpdate: "cascade" }),
}, (table) => [
  index("idx_phones_person").on(table.personId),
  index("idx_phones_status").on(table.status),
  check("chk_phones_status", sql`${table.status} IN ('checked_in', 'checked_out')`),
]);
export const storageItems = pgTable("storage_items", {
  id: id(),
  type: text("type").notNull(),
  inventoryNumber: text("inventory_number"),
  serialNumber: text("serial_number"),
  capacityGb: integer("capacity_gb"),
  accessLevel: integer("access_level"),
  status: text("status").notNull().default("stock"),
  personId: text("person_id").references(() => people.id, { onDelete: "set null", onUpdate: "cascade" }),
  issuedAt: timestamp("issued_at", { withTimezone: true }),
  returnedAt: timestamp("returned_at", { withTimezone: true }),
  notes: text("notes").notNull().default(""),
  createdAt: createdAt(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  deletedAt: timestamp("deleted_at", { withTimezone: true }),
  createdBy: text("created_by").references((): AnyPgColumn => users.id, { onDelete: "set null", onUpdate: "cascade" }),
}, (table) => [
  index("idx_storage_items_type").on(table.type),
  index("idx_storage_items_status").on(table.status),
  index("idx_storage_items_person").on(table.personId),
  check("chk_storage_items_type", sql`${table.type} IN ('flash_drive', 'electronic_pass')`),
  check("chk_storage_items_status", sql`${table.status} IN ('in_use', 'stock', 'broken', 'lost')`),
]);
export const movementLogs = pgTable("movement_logs", {
  id: id(), personId: text("person_id").references(() => people.id, { onDelete: "set null", onUpdate: "cascade" }),
  name: text("name").notNull(), from: text("from_value").notNull(), to: text("to_value").notNull(), occurredAt: createdAt("occurred_at"),
}, (table) => [index("idx_movement_logs_occurred_at").on(table.occurredAt)]);
export const groupTemplates = pgTable("group_templates", {
  id: id(), key: text("key").notNull().unique(), name: text("name").notNull(), colorToken: text("color_token").notNull(), icon: text("icon").notNull(),
  defaultPeoplePerDay: integer("default_people_per_day").notNull(), defaultActiveDays: jsonb("default_active_days").$type<number[]>().notNull(),
  sortOrder: bigint("sort_order", { mode: "number" }).notNull(), isSystem: boolean("is_system").notNull().default(false), createdAt: createdAt(),
}, (table) => [check("chk_group_templates_default_active_days_array", sql`jsonb_typeof(${table.defaultActiveDays}) = 'array'`)]);
export const dutyGroups = pgTable("duty_groups", {
  id: id(), templateId: text("template_id").notNull().references(() => groupTemplates.id, { onDelete: "restrict", onUpdate: "cascade" }),
  name: text("name").notNull(), notes: text("notes").notNull().default(""), enabled: boolean("enabled").notNull().default(true), sortOrder: bigint("sort_order", { mode: "number" }).notNull(),
  createdAt: createdAt(), updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("idx_duty_groups_template").on(table.templateId)]);
export const groupRules = pgTable("group_rules", {
  id: id(), groupId: text("group_id").notNull().references(() => dutyGroups.id, { onDelete: "cascade", onUpdate: "cascade" }).unique(),
  enabledPlatoons: jsonb("enabled_platoons").$type<string[]>().notNull(), peoplePerDay: integer("people_per_day").notNull(), assignmentQuotas: jsonb("assignment_quotas").$type<Array<{ platoonId: string; count: number }>>().notNull().default([]), autoRotate: boolean("auto_rotate").notNull().default(true), activeDays: jsonb("active_days").$type<number[]>().notNull(), priorityMode: text("priority_mode").notNull(), overlapPolicy: text("overlap_policy").notNull().default("exclusive"),
}, (table) => [
  check("chk_group_rules_active_days_array", sql`jsonb_typeof(${table.activeDays}) = 'array'`),
  check("chk_group_rules_enabled_platoons_array", sql`jsonb_typeof(${table.enabledPlatoons}) = 'array'`),
  check("chk_group_rules_assignment_quotas_array", sql`jsonb_typeof(${table.assignmentQuotas}) = 'array'`),
  check("chk_group_rules_overlap_policy", sql`${table.overlapPolicy} IN ('exclusive', 'manual')`),
]);
export const groupAssignments = pgTable("group_assignments", {
  id: id(), groupId: text("group_id").notNull().references(() => dutyGroups.id, { onDelete: "cascade", onUpdate: "cascade" }), personId: text("person_id").notNull().references(() => people.id, { onDelete: "cascade", onUpdate: "cascade" }),
  assignedDate: date("assigned_date").notNull(), source: text("source").notNull(), conflictState: text("conflict_state").notNull(), createdAt: createdAt(),
}, (table) => [uniqueIndex("uq_group_assignments_person_day").on(table.groupId, table.personId, table.assignedDate), index("idx_group_assignments_group_date").on(table.groupId, table.assignedDate), index("idx_group_assignments_group_date_created").on(table.groupId, table.assignedDate, table.createdAt), index("idx_group_assignments_person_date").on(table.personId, table.assignedDate)]);
export const groupExclusions = pgTable("group_exclusions", {
  id: id(), groupId: text("group_id").notNull().references(() => dutyGroups.id, { onDelete: "cascade", onUpdate: "cascade" }), personId: text("person_id").notNull().references(() => people.id, { onDelete: "cascade", onUpdate: "cascade" }),
  dayOfWeek: integer("day_of_week"), reason: text("reason").notNull().default(""), createdAt: createdAt(),
}, (table) => [index("idx_group_exclusions_group").on(table.groupId), index("idx_group_exclusions_group_created").on(table.groupId, table.createdAt)]);
export const tasks = pgTable("tasks", {
  id: id(), parentId: text("parent_id").references((): AnyPgColumn => tasks.id, { onDelete: "restrict", onUpdate: "cascade" }),
  title: text("title").notNull(), description: text("description").notNull().default(""),
  sortOrder: bigint("sort_order", { mode: "number" }).notNull(),
  completedAt: timestamp("completed_at", { withTimezone: true }), createdAt: createdAt(), updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
}, (table) => [index("idx_tasks_parent").on(table.parentId), index("idx_tasks_active").on(table.completedAt, table.sortOrder)]);
export const users = pgTable("users", {
  id: id(), username: text("username").notNull().unique(), passwordHash: text("password_hash").notNull(), displayName: text("display_name").notNull(), active: boolean("active").notNull().default(true), sessionVersion: integer("session_version").notNull().default(0), createdAt: createdAt(), updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});
export const roles = pgTable("roles", { id: id(), key: text("key").notNull().unique(), name: text("name").notNull(), description: text("description").notNull().default(""), isSystem: boolean("is_system").notNull().default(false), createdAt: createdAt() });
export const permissions = pgTable("permissions", { key: text("key").primaryKey(), label: text("label").notNull(), description: text("description").notNull().default("") });
export const userRoles = pgTable("user_roles", { userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }), roleId: text("role_id").notNull().references(() => roles.id, { onDelete: "cascade", onUpdate: "cascade" }) }, (table) => [primaryKey({ columns: [table.userId, table.roleId] })]);
export const rolePermissions = pgTable("role_permissions", { roleId: text("role_id").notNull().references(() => roles.id, { onDelete: "cascade", onUpdate: "cascade" }), permissionKey: text("permission_key").notNull().references(() => permissions.key, { onDelete: "cascade", onUpdate: "cascade" }) }, (table) => [primaryKey({ columns: [table.roleId, table.permissionKey] })]);
export const sessions = pgTable("sessions", { tokenHash: text("token_hash").primaryKey(), userId: text("user_id").notNull().references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }), sessionVersion: integer("session_version").notNull().default(0), expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(), createdAt: createdAt() }, (table) => [index("idx_sessions_user").on(table.userId), index("idx_sessions_expires_at").on(table.expiresAt)]);
export const loginRateLimits = pgTable("login_rate_limits", {
  key: text("key").primaryKey(),
  attemptCount: integer("attempt_count").notNull().default(0),
  windowStartedAt: timestamp("window_started_at", { withTimezone: true }).defaultNow().notNull(),
  blockedUntil: timestamp("blocked_until", { withTimezone: true }),
});
export const authAuditEvents = pgTable(
  "auth_audit_events",
  {
    id: id(),
    action: text("action").notNull(),
    actorUserId: text("actor_user_id").references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    targetUserId: text("target_user_id").references(() => users.id, {
      onDelete: "set null",
      onUpdate: "cascade",
    }),
    metadata: jsonb("metadata").notNull().default({}),
    occurredAt: timestamp("occurred_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index("idx_auth_audit_events_occurred_at").on(table.occurredAt),
    index("idx_auth_audit_events_target").on(table.targetUserId, table.occurredAt),
  ],
);
