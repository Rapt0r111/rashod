import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Critical UI regression contracts", () => {
  it("exposes logout on desktop and mobile navigation", () => {
    const topBar = read("src/features/roster/components/top-bar.tsx");
    const navigation = read("src/features/roster/components/navigation.tsx");

    expect(topBar).toContain("onClick={props.onLogout}");
    expect(navigation).toContain("onClick={onLogout}");
  });

  it("filters inaccessible service sections and rejects forbidden history state", () => {
    const app = read("src/features/roster/RosterApp.tsx");
    const navigation = read("src/features/roster/components/navigation.tsx");

    expect(navigation).toContain('section.key !== "groups" || canReadGroups');
    expect(navigation).toContain('section.key !== "tasks" || canReadTasks');
    expect(app).toContain("if (!canAccessSection(key)) return;");
    expect(app).toContain("canAccessSection(nextSection)");
  });

  it("makes roster and groups mutation controls inert for read-only users", () => {
    const app = read("src/features/roster/RosterApp.tsx");
    const people = read("src/features/roster/components/person-views.tsx");
    const groups = read("src/features/groups/GroupsApp.tsx");

    expect(app).toContain('hasPermission(permissionContext, "roster:write")');
    expect(app).toContain("canWrite={canWriteRoster}");
    expect(people).toContain("{canWrite && (");
    expect(people).toContain("disabled={!canWrite}");
    expect(groups).toContain("disabled={isBusy || !canWrite}");
    expect(groups).toContain("activeSnapshot && canWrite");
  });

  it("shows retry UI for lazy workspaces", () => {
    const app = read("src/features/roster/RosterApp.tsx");

    expect(app).toContain("function SectionLoadFailure");
    expect(app).toContain("sectionLoadErrors.groups");
    expect(app).toContain("onRetry={loadGroupsSnapshot}");
    expect(app).toContain("sectionLoadErrors.tasks");
    expect(app).toContain("onRetry={loadTasksSnapshot}");
  });

  it("keeps roster summary metrics in the actionable operator bar", () => {
    const app = read("src/features/roster/RosterApp.tsx");
    const topBar = read("src/features/roster/components/top-bar.tsx");
    const operatorBar = read("src/features/roster/components/operator-bar.tsx");

    expect(app).toContain("<OperatorBar");
    expect(topBar).not.toContain("SummaryChip");
    expect(topBar).not.toContain("total: number");
    expect(topBar).not.toContain("rota: number");
    expect(operatorBar).toContain("<SearchSortControl");
    expect(operatorBar).toContain("onLocationFilter");
  });

  it("keeps content surfaces flat while preserving overlay depth", () => {
    const main = read("src/features/roster/components/main-content.tsx");
    const people = read("src/features/roster/components/person-views.tsx");
    const admin = read("src/features/roster/components/admin-panel.tsx");
    const topBar = read("src/features/roster/components/top-bar.tsx");
    const dialogs = read("src/features/roster/components/dialogs.tsx");

    expect(main).not.toContain("shadow-(--shadow)");
    expect(main).not.toContain("0_0_18px");
    expect(people).not.toContain("shadow-(--shadow)");
    expect(admin).not.toContain("shadow-(--shadow)");
    expect(admin).not.toContain("0_8px_22px");
    expect(topBar).not.toContain("shadow-[0_12px_36px");
    expect(dialogs).toContain("shadow-[0_30px_90px");
  });

  it("redirects expired task sessions and closes references without a back loop", () => {
    const apiClient = read("src/lib/api-client.ts");
    const references = read("src/features/roster/ReferencesApp.tsx");

    expect(apiClient).toContain("response.status === 401");
    expect(apiClient).toContain('window.location.assign("/")');
    expect(references).toContain('router.replace("/")');
    expect(references).not.toContain('router.push("/")');
  });

  it("covers zero filtered roster results and visible async failures", () => {
    const app = read("src/features/roster/RosterApp.tsx");
    const main = [
      read("src/features/roster/components/main-content.tsx"),
      read("src/features/roster/components/overview-section.tsx"),
      read("src/features/roster/components/overview-primitives.tsx"),
      read("src/features/roster/components/roster-sections.tsx"),
    ].join("\n");
    const admin = [
      read("src/features/roster/components/admin-panel.tsx"),
      read("src/features/roster/components/admin/platoon-admin.tsx"),
      read("src/features/roster/components/admin/location-admin.tsx"),
    ].join("\n");

    expect(main).toContain("visibleGroups.length === 0");
    expect(app).toContain("Не удалось отменить изменение");
    expect(app).toContain("Не удалось выйти");
    expect(app).toContain("Не удалось изменить полноэкранный режим");
    expect(admin).toContain("Подразделение не сохранено");
    expect(admin).toContain("Локация не сохранена");
  });

  it("guards destructive group deletion and provides an app error boundary", () => {
    const groups = [
      read("src/features/groups/GroupsApp.tsx"),
      read("src/features/groups/components/settings-panel.tsx"),
    ].join("\n");
    const errorBoundary = read("src/app/error.tsx");

    expect(groups).toContain("Удалить группу?");
    expect(groups).toContain("без возможности отмены");
    expect(groups).toContain("Отмена");
    expect(groups).not.toContain("window.confirm");
    expect(errorBoundary).toContain('"use client"');
    expect(errorBoundary).toContain("unstable_retry");
    expect(errorBoundary).toContain('role="alert"');
  });
});
