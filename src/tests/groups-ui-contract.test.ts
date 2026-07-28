import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const workspaceSource = readFileSync(
  resolve(process.cwd(), "src/features/WorkspaceApp.tsx"),
  "utf8",
);
const groupsSource = readFileSync(
  resolve(process.cwd(), "src/features/groups/GroupsApp.tsx"),
  "utf8",
);
const searchSource = readFileSync(
  resolve(process.cwd(), "src/components/search-sort-control.tsx"),
  "utf8",
);

describe("Groups responsive UI contract", () => {
  it("gives the standalone groups route its own scroll container", () => {
    expect(workspaceSource).toContain(
      'className="h-dvh min-h-0 min-w-0 overflow-y-auto overscroll-contain bg-bg-base"',
    );
  });

  it("uses mobile-first breakpoints for the groups workspace", () => {
    expect(groupsSource).toContain("lg:grid-cols-[minmax(210px,250px)_minmax(0,1fr)]");
    expect(groupsSource).toContain("xl:grid-cols-[minmax(210px,250px)_minmax(0,1fr)_minmax(260px,310px)]");
    expect(groupsSource).toContain("sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7");
    expect(groupsSource).not.toContain("max-[860px]:grid-cols-1");
    expect(groupsSource).not.toContain("max-[520px]:grid-cols-1");
  });

  it("lets the shared search control shrink inside narrow panels", () => {
    expect(searchSource).toContain("min-w-0 flex-1 basis-full");
    expect(searchSource).toContain("w-full min-w-0 shrink-0");
    expect(searchSource).not.toContain("min-w-45 flex-1 basis-65");
  });

  it("contains the group toolbar title and keeps actions in an adaptive grid", () => {
    const toolbarSource = groupsSource.slice(
      groupsSource.indexOf("function GroupToolbar"),
      groupsSource.indexOf("function WeekStrip"),
    );

    expect(toolbarSource).toContain(
      "min-[1800px]:grid-cols-[minmax(0,1fr)_auto]",
    );
    expect(toolbarSource).toContain(
      "grid-cols-[repeat(auto-fit,minmax(140px,1fr))]",
    );
    expect(toolbarSource).toContain("min-w-0");
    expect(toolbarSource).not.toContain("min-[1100px]:grid-cols");
  });

  it("handles mutation API errors inside the click callback", () => {
    const mutationSource = groupsSource.slice(
      groupsSource.indexOf("async function run("),
      groupsSource.indexOf("async function assignPerson("),
    );

    expect(mutationSource).toContain("catch {");
    expect(mutationSource).toContain("setError(message);");
    expect(mutationSource).not.toContain("throw err");
  });

  it("takes platoons from the groups snapshot so groups-only users can edit rules", () => {
    expect(groupsSource).toContain("useState<Platoon[]>(initialSnapshot.platoons)");
    expect(groupsSource).toContain("setPlatoons(next.platoons)");
    expect(groupsSource).not.toContain('fetch("/api/platoons")');
  });
});
