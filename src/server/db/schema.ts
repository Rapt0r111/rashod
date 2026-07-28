import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const people = sqliteTable("people", {
  id: text("id").primaryKey(),
  platoonId: text("platoon_id").notNull(),
  rank: text("rank").notNull(),
  name: text("name").notNull(),
  conscriptionNumber: text("conscription_number"),
  location: text("location").notNull(),
  sortOrder: integer("sort_order").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const platoons = sqliteTable("platoons", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  sortOrder: integer("sort_order").notNull(),
  isSystem: integer("is_system", { mode: "boolean" }).notNull(),
});

export const locations = sqliteTable("locations", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  label: text("label").notNull(),
  colorToken: text("color_token").notNull(),
  isQuick: integer("is_quick", { mode: "boolean" }).notNull(),
  quickCode: text("quick_code"),
  isSystem: integer("is_system", { mode: "boolean" }).notNull(),
  sortOrder: integer("sort_order").notNull(),
});

export const movementLogs = sqliteTable("movement_logs", {
  id: text("id").primaryKey(),
  personId: text("person_id").notNull(),
  name: text("name").notNull(),
  from: text("from_value").notNull(),
  to: text("to_value").notNull(),
  ts: integer("ts").notNull(),
});

export const groupTemplates = sqliteTable("group_templates", {
  id: text("id").primaryKey(),
  key: text("key").notNull().unique(),
  name: text("name").notNull(),
  colorToken: text("color_token").notNull(),
  icon: text("icon").notNull(),
  defaultPeoplePerDay: integer("default_people_per_day").notNull(),
  defaultActiveDays: text("default_active_days").notNull(),
  sortOrder: integer("sort_order").notNull(),
  isSystem: integer("is_system", { mode: "boolean" }).notNull(),
  createdAt: integer("created_at").notNull(),
});

export const dutyGroups = sqliteTable("duty_groups", {
  id: text("id").primaryKey(),
  templateId: text("template_id").notNull(),
  name: text("name").notNull(),
  notes: text("notes").notNull(),
  enabled: integer("enabled", { mode: "boolean" }).notNull(),
  sortOrder: integer("sort_order").notNull(),
  createdAt: integer("created_at").notNull(),
  updatedAt: integer("updated_at").notNull(),
});

export const groupRules = sqliteTable("group_rules", {
  id: text("id").primaryKey(),
  groupId: text("group_id").notNull(),
  enabledPlatoons: text("enabled_platoons").notNull(),
  peoplePerDay: integer("people_per_day").notNull(),
  autoRotate: integer("auto_rotate", { mode: "boolean" }).notNull(),
  activeDays: text("active_days").notNull(),
  priorityMode: text("priority_mode").notNull(),
});

export const groupAssignments = sqliteTable("group_assignments", {
  id: text("id").primaryKey(),
  groupId: text("group_id").notNull(),
  personId: text("person_id").notNull(),
  assignedDate: text("assigned_date").notNull(),
  source: text("source").notNull(),
  conflictState: text("conflict_state").notNull(),
  createdAt: integer("created_at").notNull(),
});

export const groupExclusions = sqliteTable("group_exclusions", {
  id: text("id").primaryKey(),
  groupId: text("group_id").notNull(),
  personId: text("person_id").notNull(),
  dayOfWeek: integer("day_of_week"),
  reason: text("reason").notNull(),
  createdAt: integer("created_at").notNull(),
});

