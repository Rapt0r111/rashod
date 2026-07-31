import postgres from "postgres";
import { createSeedData } from "../src/server/db/seed";
import { migratePostgres } from "../src/server/db/migrate-postgres";
import { assertTestDatabaseUrl } from "../test-support/database";

export const TEST_PASSWORD = "Rashod-e2e-2026!";

const permissions = [
  "roster:read",
  "roster:write",
  "references:manage",
  "groups:read",
  "groups:write",
  "tasks:read",
  "tasks:write",
  "users:manage",
  "roles:manage",
  "access:grant",
] as const;
const roles = [
  { id: "role-administrator", key: "administrator", name: "Администратор", permissions: [...permissions], system: true },
  { id: "role-roster-reader", key: "roster_reader", name: "Чтение состава", permissions: ["roster:read"], system: false },
  { id: "role-roster-writer", key: "roster_writer", name: "Оператор состава", permissions: ["roster:read", "roster:write", "references:manage"], system: false },
  { id: "role-groups-reader", key: "groups_reader", name: "Чтение групп", permissions: ["groups:read"], system: false },
  { id: "role-groups-writer", key: "groups_writer", name: "Оператор групп", permissions: ["groups:read", "groups:write"], system: false },
  { id: "role-tasks-reader", key: "tasks_reader", name: "Чтение задач", permissions: ["tasks:read"], system: false },
  { id: "role-tasks-writer", key: "tasks_writer", name: "Оператор задач", permissions: ["tasks:read", "tasks:write"], system: false },
  { id: "role-no-access", key: "no_access", name: "Без доступа", permissions: [], system: false },
] as const;
const users = [
  ["user-admin", "admin", "Администратор E2E", "role-administrator"],
  ["user-roster-reader", "roster-reader", "Читатель состава", "role-roster-reader"],
  ["user-roster-writer", "roster-writer", "Оператор состава", "role-roster-writer"],
  ["user-groups-reader", "groups-reader", "Читатель групп", "role-groups-reader"],
  ["user-groups-writer", "groups-writer", "Оператор групп", "role-groups-writer"],
  ["user-tasks-reader", "tasks-reader", "Читатель задач", "role-tasks-reader"],
  ["user-tasks-writer", "tasks-writer", "Оператор задач", "role-tasks-writer"],
  ["user-no-access", "no-access", "Без рабочего доступа", "role-no-access"],
] as const;

const url = assertTestDatabaseUrl();
process.env.DATABASE_URL = url;
const sql = postgres(url, { max: 1 });

try {
  await sql.unsafe("DROP SCHEMA public CASCADE");
  await sql.unsafe("CREATE SCHEMA public");
  await migratePostgres(sql);
  const seed = createSeedData();
  await sql.begin(async (transaction) => {
    for (const platoon of seed.platoons) {
      await transaction`
        INSERT INTO platoons (id, key, label, sort_order, is_system)
        VALUES (${platoon.id}, ${platoon.key}, ${platoon.label}, ${platoon.sortOrder}, ${platoon.isSystem})
      `;
    }
    for (const location of seed.locations) {
      await transaction`
        INSERT INTO locations (id, key, label, color_token, is_quick, quick_code, is_system, counts_as_present, sort_order)
        VALUES (
          ${location.id}, ${location.key}, ${location.label}, ${location.colorToken},
          ${location.isQuick}, ${location.quickCode ?? null}, ${location.isSystem},
          ${location.countsAsPresent}, ${location.sortOrder}
        )
      `;
    }
    for (const person of seed.people) {
      await transaction`
        INSERT INTO people (id, platoon_id, rank, name, conscription_number, location, sort_order, created_at, updated_at)
        VALUES (${person.id}, ${person.platoonId}, ${person.rank}, ${person.name}, ${person.conscriptionNumber ?? null}, ${person.location}, ${person.sortOrder}, ${new Date(person.createdAt)}, ${new Date(person.updatedAt)})
      `;
    }
    await transaction`
      INSERT INTO overview_settings (id, config)
      VALUES ('default', ${transaction.json(seed.overviewSettings)}::jsonb)
    `;
    for (const permission of permissions) {
      await transaction`
        INSERT INTO permissions (key, label, description)
        VALUES (${permission}, ${permission}, 'E2E permission')
      `;
    }
    for (const role of roles) {
      await transaction`
        INSERT INTO roles (id, key, name, description, is_system)
        VALUES (${role.id}, ${role.key}, ${role.name}, 'E2E role', ${role.system})
      `;
      for (const permission of role.permissions) {
        await transaction`
          INSERT INTO role_permissions (role_id, permission_key)
          VALUES (${role.id}, ${permission})
        `;
      }
    }
    const passwordHash = await Bun.password.hash(TEST_PASSWORD, { algorithm: "argon2id" });
    for (const [id, username, displayName, roleId] of users) {
      await transaction`
        INSERT INTO users (id, username, password_hash, display_name)
        VALUES (${id}, ${username}, ${passwordHash}, ${displayName})
      `;
      await transaction`INSERT INTO user_roles (user_id, role_id) VALUES (${id}, ${roleId})`;
    }
    await transaction`
      INSERT INTO group_templates
        (id, key, name, color_token, icon, default_people_per_day, default_active_days, sort_order, is_system)
      VALUES
        ('template-e2e', 'e2e', 'Тестовый наряд', 'users', 'users', 2,
         ${transaction.json([0, 1, 2, 3, 4, 5, 6])}::jsonb, 1, true)
    `;
    await transaction`
      INSERT INTO duty_groups (id, template_id, name, enabled, sort_order)
      VALUES ('group-e2e', 'template-e2e', 'Тестовая группа', true, 1)
    `;
    await transaction`
      INSERT INTO group_rules
        (id, group_id, enabled_platoons, people_per_day, auto_rotate, active_days, priority_mode)
      VALUES
        ('rule-e2e', 'group-e2e', ${transaction.json(seed.platoons.map((item) => item.id))}::jsonb,
         2, true, ${transaction.json([0, 1, 2, 3, 4, 5, 6])}::jsonb, 'oldest')
    `;
    await transaction`
      INSERT INTO group_exclusions (id, group_id, person_id, day_of_week, reason)
      VALUES ('exclusion-e2e', 'group-e2e', ${seed.people[0].id}, NULL, 'E2E exclusion')
    `;
  });
  console.log("Test database migrated and seeded.");
} finally {
  await sql.end({ timeout: 5 });
}
