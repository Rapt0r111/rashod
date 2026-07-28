import { describe, expect, it } from "vitest";
import type { AuthContext } from "@/server/auth";
import { pg } from "@/server/db/postgres";
import { POSTGRES_MIGRATIONS } from "@/server/db/migrate-postgres";
import { runAuditedMutation } from "@/server/http";

describe("isolated PostgreSQL test database", () => {
  it("runs only against a test-named database with the latest migration", async () => {
    const sql = pg();
    const [database] = await sql<Array<{ name: string }>>`SELECT current_database() AS name`;
    expect(database.name).toMatch(/test/i);
    const latestMigration = POSTGRES_MIGRATIONS.at(-1)!;
    const [migration] = await sql<Array<{ count: number }>>`
      SELECT count(*)::int AS count
      FROM schema_migrations
      WHERE name = ${latestMigration}
    `;
    expect(migration.count).toBe(1);
  });

  it("contains deterministic role and roster fixtures", async () => {
    const sql = pg();
    const [fixtures] = await sql<Array<{ users: number; people: number }>>`
      SELECT
        (SELECT count(*)::int FROM users) AS users,
        (SELECT count(*)::int FROM people) AS people
    `;
    expect(fixtures.users).toBeGreaterThanOrEqual(8);
    expect(fixtures.people).toBeGreaterThan(0);
  });

  it("rolls back mutation and audit together in one transaction", async () => {
    const sql = pg();
    const marker = `rollback-${Date.now()}`;
    const auth: AuthContext = {
      user: {
        id: crypto.randomUUID(),
        username: "rollback-probe",
        displayName: "Rollback Probe",
      },
      permissions: [],
      roleIds: [],
    };
    await expect(
      runAuditedMutation(
        auth,
        "test.rollback",
        async () => {
          await pg()`
          INSERT INTO tasks (id, title, description, sort_order)
          VALUES (${crypto.randomUUID()}, ${marker}, '', 0)
        `;
          return null;
        },
        { marker },
      ),
    ).rejects.toThrow();
    const [result] = await sql<Array<{ tasks: number; audits: number }>>`
      SELECT
        (SELECT count(*)::int FROM tasks WHERE title = ${marker}) AS tasks,
        (SELECT count(*)::int FROM auth_audit_events WHERE metadata->>'marker' = ${marker}) AS audits
    `;
    expect(result).toEqual({ tasks: 0, audits: 0 });
  });
});
