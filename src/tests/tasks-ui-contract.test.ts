import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("Tasks UI contracts", () => {
  it("keeps custom select popovers measurable and visible", () => {
    const select = read("src/components/select-field.tsx");

    expect(select).toContain("top-[calc(100%+6px)]");
    expect(select).not.toContain("inset-[calc(100%+6px)]");
  });

  it("resets every active task filter, including sorting", () => {
    const tasks = read("src/features/tasks/TasksApp.tsx");

    expect(tasks).toContain('Number(Boolean(query.trim()))');
    expect(tasks).toContain("filters.length");
    expect(tasks).toContain("filters.includes(\"with-steps\")");
    expect(tasks).toContain("setFilters([])");
    expect(tasks).toContain('setSort({ key: "alpha", direction: "asc" })');
    expect(tasks).toContain("showSort={false}");
  });

  it("refreshes tasks after shared roster events", () => {
    const tasks = read("src/features/tasks/TasksApp.tsx");

    expect(tasks).toContain('new EventSource("/api/events")');
    expect(tasks).toContain('source.addEventListener("roster", () => void refresh())');
    expect(tasks).toContain("source.close()");
  });

  it("makes collapsed controls inert while hidden", () => {
    const disclosure = read("src/components/disclosure-content.tsx");

    expect(disclosure).toContain("inert={!open || undefined}");
  });
});
