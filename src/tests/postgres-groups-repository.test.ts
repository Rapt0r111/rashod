import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  groupAssignmentIneligibility,
  normalizeActiveDays,
  normalizeStringArray,
} from "@/server/db/postgres-groups-repository";

const repositorySource = readFileSync(
  resolve(process.cwd(), "src/server/db/postgres-groups-repository.ts"),
  "utf8",
);

describe("postgres groups repository normalization", () => {
  it("accepts JSONB scalar strings for active days and normalizes integers", () => {
    expect(normalizeActiveDays("[6, 1, \"1\", 0, 9, -1, 2.5, \"bad\"]")).toEqual([0, 1, 6]);
  });

  it("falls back when active days are not an array and keeps an explicit empty selection", () => {
    expect(normalizeActiveDays("\"not-array\"", [1, 3])).toEqual([1, 3]);
    expect(normalizeActiveDays([], [2])).toEqual([]);
    expect(normalizeActiveDays([9], [2])).toEqual([2]);
  });

  it("accepts JSONB scalar strings for enabled platoons and removes blanks/duplicates", () => {
    expect(normalizeStringArray("[\"p1\", \"\", \"p2\", \"p1\", 3]")).toEqual(["p1", "p2"]);
  });

  it("passes rule arrays to postgres as JSON values instead of JSON strings", () => {
    expect(repositorySource).toContain("${sql.json(rule.enabledPlatoons)}::jsonb");
    expect(repositorySource).toContain("${sql.json(rule.activeDays)}::jsonb");
    expect(repositorySource).not.toContain("${JSON.stringify(rule.enabledPlatoons)}::jsonb");
    expect(repositorySource).not.toContain("${JSON.stringify(rule.activeDays)}::jsonb");
  });

  it("uses shared platoon filter and keeps conflict fallback for quota auto-fill", () => {
    expect(repositorySource).toContain("rulePlatoonFilter(rule)");
    expect(repositorySource).toContain("selectQuotaRotationPool(candidates, quota.platoonId, assignedIds)");
    // Must not pre-filter blocked people out of the quota pool (breaks conflict fallback).
    expect(repositorySource).not.toContain("!blocked.has(person.id)");
  });
});

describe("manual group assignment eligibility", () => {
  const eligible = {
    groupEnabled: true,
    activeDays: [1, 3, 5],
    dayOfWeek: 3,
    enabledPlatoons: ["p1", "p2"],
    personPlatoonId: "p1",
    excluded: false,
  };

  it.each([
    [{ ...eligible, groupEnabled: false }, "group_disabled"],
    [{ ...eligible, dayOfWeek: 2 }, "inactive_day"],
    [{ ...eligible, personPlatoonId: "p3" }, "platoon_disabled"],
    [{ ...eligible, excluded: true }, "excluded"],
  ] as const)("rejects an ineligible assignment with reason %s", (input, reason) => {
    expect(groupAssignmentIneligibility(input)).toBe(reason);
  });

  it("accepts a person who satisfies the group rule", () => {
    expect(groupAssignmentIneligibility(eligible)).toBeNull();
  });

  it("treats an empty platoon list as unrestricted", () => {
    expect(groupAssignmentIneligibility({ ...eligible, enabledPlatoons: [] })).toBeNull();
  });
});
