import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { POSTGRES_MIGRATIONS, migrationPath } from "@/server/db/migrate-postgres";
import { normalizeActiveDays } from "@/server/db/postgres-groups-repository";

const rosterRepositorySource = readFileSync(
  resolve(process.cwd(), "src/server/db/postgres-roster-repository.ts"),
  "utf8",
);

describe("PostgreSQL data integrity normalization", () => {
  it("accepts JSONB scalar strings containing day arrays", () => {
    expect(normalizeActiveDays('[6, 1, 1, 0, 9, -1, "2"]')).toEqual([0, 1, 2, 6]);
  });

  it("falls back when active days are not an array and keeps an explicit empty selection", () => {
    expect(normalizeActiveDays("not json", [1, 2])).toEqual([1, 2]);
    expect(normalizeActiveDays([], [3])).toEqual([]);
    expect(normalizeActiveDays([9], [3])).toEqual([3]);
  });

  it("keeps the data-integrity and ZГТ migrations in the runner order", () => {
    expect(POSTGRES_MIGRATIONS).toContain("0010_group_overlap_policy.sql");
    expect(POSTGRES_MIGRATIONS).toEqual(
      expect.arrayContaining([
        "0010_group_overlap_policy.sql",
        "0011_zgt_personnel_and_equipment.sql",
        "0012_zgt_phones_and_storage_items.sql",
        "0013_phones_person_set_null.sql",
        "0014_location_foreign_keys.sql",
      ]),
    );
    const idx10 = POSTGRES_MIGRATIONS.indexOf("0010_group_overlap_policy.sql");
    const idx11 = POSTGRES_MIGRATIONS.indexOf("0011_zgt_personnel_and_equipment.sql");
    const idx12 = POSTGRES_MIGRATIONS.indexOf("0012_zgt_phones_and_storage_items.sql");
    const idx13 = POSTGRES_MIGRATIONS.indexOf("0013_phones_person_set_null.sql");
    const idx14 = POSTGRES_MIGRATIONS.indexOf("0014_location_foreign_keys.sql");
    expect(idx11).toBeGreaterThan(idx10);
    expect(idx12).toBeGreaterThan(idx11);
    expect(idx13).toBeGreaterThan(idx12);
    expect(idx14).toBeGreaterThan(idx13);
    expect(migrationPath("/repo", "0010_group_overlap_policy.sql")).toContain("drizzle");
  });

  it("writes overview settings as a JSON object, not a JSONB string", () => {
    expect(rosterRepositorySource).toContain("${sql.json(config)}::jsonb");
    expect(rosterRepositorySource).not.toContain("${JSON.stringify(config)}::jsonb");
  });

  it("never writes client-supplied isSystem onto locations or platoons", () => {
    expect(rosterRepositorySource).not.toContain("input.isSystem");
    expect(rosterRepositorySource).not.toContain("is_system = EXCLUDED.is_system");
    expect(rosterRepositorySource).toContain(
      "${record.quickCode}, false, ${record.countsAsPresent}, ${record.sortOrder}",
    );
    expect(rosterRepositorySource).toContain(
      "VALUES (${record.id}, ${record.key}, ${record.label}, ${record.sortOrder}, false)",
    );
  });

  it("unlinks phones before deleting a person and uses SET NULL like equipment", () => {
    const migration = readFileSync(
      resolve(process.cwd(), "drizzle/0013_phones_person_set_null.sql"),
      "utf8",
    );
    expect(migration).toContain("ON DELETE SET NULL");
    expect(migration).toContain("ALTER TABLE phones ALTER COLUMN person_id DROP NOT NULL");
    expect(rosterRepositorySource).toContain("UPDATE phones");
    expect(rosterRepositorySource).toContain("person_id = NULL");
    expect(rosterRepositorySource).toContain("status = 'checked_in'");
    expect(rosterRepositorySource).toContain("DELETE FROM people WHERE id = ${id} RETURNING id");
    expect(rosterRepositorySource).toContain("INSERT INTO movement_logs");
    const locationKeys = readFileSync(
      resolve(process.cwd(), "drizzle/0014_location_foreign_keys.sql"),
      "utf8",
    );
    expect(locationKeys).toContain("people_location_fkey");
    expect(locationKeys).toContain("location_group_members_location_fkey");
  });

  it("hard-blocks DELETE of system locations and platoons", () => {
    expect(rosterRepositorySource).toContain('throw new Error("SYSTEM_LOCATION_PROTECTED")');
    expect(rosterRepositorySource).toContain('throw new Error("SYSTEM_PLATOON_PROTECTED")');
    expect(rosterRepositorySource).toContain(
      'SELECT is_system AS "isSystem" FROM platoons WHERE id = ${id} FOR UPDATE',
    );
    expect(rosterRepositorySource).toContain(
      "SELECT key, is_system AS \"isSystem\" FROM locations WHERE id = ${id} FOR UPDATE",
    );
  });
});
