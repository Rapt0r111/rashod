import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("schedule UI integration contract", () => {
  it("keeps the schedule as a lazy roster section with recoverable loading", () => {
    const roster = read("src/features/roster/RosterApp.tsx");
    const sections = read("src/features/roster/constants.ts");
    expect(sections).toContain('{ key: "schedule", label: "График" }');
    expect(roster).toContain('import("../schedule/ScheduleApp")');
    expect(roster).toContain('state.ui.activeSection === "schedule"');
    expect(roster).toContain("sectionLoadErrors.schedule");
    expect(roster).toContain("loadScheduleSnapshot");
  });

  it("keeps print, CSV, range and conflict affordances in the schedule surface", () => {
    const schedule = read("src/features/schedule/ScheduleApp.tsx");
    const route = read("src/app/api/schedule/route.ts");
    expect(schedule).toContain('type="date"');
    expect(schedule).toContain('window.print()');
    expect(schedule).toContain("exportScheduleCsv");
    expect(schedule).toContain('role="alert"');
    expect(schedule).toContain("assignment.conflictState === \"warning\"");
    expect(route).toContain('requireAnyPermission(request, ["roster:read", "groups:read"])');
    expect(route).toContain("scheduleDateRange(from, to)");
  });
});