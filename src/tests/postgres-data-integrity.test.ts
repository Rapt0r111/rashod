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

  it("keeps the data-integrity migration in the runner order", () => {
    expect(POSTGRES_MIGRATIONS.at(-1)).toBe("0009_group_assignment_quotas.sql");
    expect(migrationPath("/repo", "0009_group_assignment_quotas.sql")).toContain("drizzle");
  });

  it("writes overview settings as a JSON object, not a JSONB string", () => {
    expect(rosterRepositorySource).toContain("${sql.json(config)}::jsonb");
    expect(rosterRepositorySource).not.toContain("${JSON.stringify(config)}::jsonb");
  });
});
