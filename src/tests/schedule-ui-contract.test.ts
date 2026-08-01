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
    expect(schedule).not.toContain("Сформировать автоматически");
    expect(schedule).toContain("Обзор периода");
    expect(schedule).toContain("Назначить вручную");
    expect(schedule).toContain("assignSchedulePerson(editorGroupId, selectedPerson.id, cellTarget.date)");
    expect(schedule).toContain('useRealtimeDomain(["groups", "roster", "unknown"]');
    expect(schedule).toContain("await loadSnapshot(snapshot.from, snapshot.to)");
    expect(schedule).toContain("role={canWrite ? \"button\" : undefined}");
    expect(schedule).toContain("Открыть редактор назначений");
    expect(schedule).toContain("Рабочий состав");
    expect(schedule).toContain("Фильтр по подразделению");
    expect(schedule).toContain("Фильтр по группе");
    expect(schedule).toContain('groupFilter !== "all"');
    expect(schedule).toContain("Фильтр по статусу назначения");
    expect(schedule).toContain("Быстрые диапазоны загружаются сразу");
    expect(schedule).toContain("Вертикальный график");
    expect(schedule).toContain("max-[480px]:grid");
    expect(schedule).toContain('role="dialog"');
    expect(read("src/app/globals.css")).toContain(".schedule-table thead .schedule-sticky");
    expect(schedule).toContain('aria-modal="true"');
    expect(schedule).toContain('event.key === "Escape"');
    expect(schedule).toContain("scheduleAssignmentState(selectedAssignments)");
    expect(schedule).toContain("Совмещение разрешено");
    expect(schedule).toContain("Нет назначений");
    expect(schedule).not.toContain("function AssignmentHint");
    expect(schedule).not.toContain("schedule-assignment-hint");
  });

  it("exposes the explicit generation endpoint and group workspace entry", () => {
    const generateRoute = read("src/app/api/schedule/generate/route.ts");
    const workspace = read("src/features/WorkspaceApp.tsx");
    expect(generateRoute).toContain('"groups.schedule.generated"');
    expect(generateRoute).toContain("materializePostgresAutomaticDutyAssignments");
    expect(workspace).toContain("График");
  });
});
