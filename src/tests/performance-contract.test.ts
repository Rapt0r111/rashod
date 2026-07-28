import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("performance contracts", () => {
  it("does not load optional roster sections or admin code in the initial client graph", () => {
    const roster = read("src/features/roster/RosterApp.tsx");
    const page = read("src/app/page.tsx");
    const workspace = read("src/features/WorkspaceApp.tsx");

    expect(roster).toContain('import("../groups/GroupsApp")');
    expect(roster).toContain('import("../tasks/TasksApp")');
    expect(roster).toContain('import("./components/admin-panel")');
    expect(roster).toContain('import("../groups/api")');
    expect(roster).toContain('import("../tasks/api")');
    expect(roster).not.toContain('import { GroupsApp } from "../groups/GroupsApp"');
    expect(roster).not.toContain('import { TasksApp } from "../tasks/TasksApp"');
    expect(page).not.toContain('from "@/features/groups/GroupsApp"');
    expect(page).not.toContain('from "@/features/tasks/TasksApp"');
    expect(workspace).toContain('import("./groups/GroupsApp")');
    expect(workspace).toContain('import("./tasks/TasksApp")');
  });

  it("loads optional section data only after that section is selected", () => {
    const roster = read("src/features/roster/RosterApp.tsx");

    expect(roster).toContain('state.ui.activeSection === "groups"');
    expect(roster).toContain('state.ui.activeSection === "tasks"');
    expect(roster).not.toContain("if (canReadGroups) fetchGroupsSnapshot()");
    expect(roster).not.toContain("if (canReadTasks) fetchTasksSnapshot()");
  });

  it("builds the groups snapshot from batched assignment and exclusion queries", () => {
    const repository = read("src/server/db/postgres-groups-repository.ts");

    expect(repository).toContain('FROM group_assignments ga');
    expect(repository).toContain('FROM group_exclusions ge');
    expect(repository).toContain("assignmentsByPersonDate");
    expect(repository).not.toContain("async function buildDutyGroupSnapshot(");
  });

  it("updates the clock without putting the roster tree on a timer", () => {
    const roster = read("src/features/roster/RosterApp.tsx");
    const topBar = read("src/features/roster/components/top-bar.tsx");

    expect(roster).not.toContain("setInterval(() => setClock");
    expect(topBar).toContain("setInterval(() => setNow");
  });
});
