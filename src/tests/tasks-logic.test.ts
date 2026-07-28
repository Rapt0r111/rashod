import { describe, expect, it } from "vitest";
import { filterTaskTree, taskProgress, taskTree, toggleTaskFilter } from "@/features/tasks/logic";
import type { Task } from "@/features/tasks/types";

const task = (id: string, parentId: string | null, completedAt: number | null = null): Task => ({ id, parentId, title: id, description: "", sortOrder: 1, completedAt, createdAt: 1, updatedAt: 1 });

describe("task helpers", () => {
  it("groups only direct subtasks under their parent", () => {
    const items = [task("child", "parent"), task("parent", null), task("top", null)];
    const tree = taskTree(items);
    expect(tree.map((item) => item.id)).toEqual(["parent", "top"]);
    expect(tree[0].children.map((item) => item.id)).toEqual(["child"]);
  });

  it("reports finished subtasks for active parent", () => {
    const parent = task("parent", null);
    expect(taskProgress(parent, [parent, task("one", "parent", 10), task("two", "parent")])).toEqual({ complete: 1, total: 2 });
  });

  it("toggles task filters and combines selected types", () => {
    const parent = task("parent", null);
    const simple = task("simple", null);
    const tree = taskTree([parent, task("child", "parent"), simple]);
    const withSteps = toggleTaskFilter([], "with-steps");
    const withBoth = toggleTaskFilter(withSteps, "simple");

    expect(filterTaskTree(tree, withSteps).map((item) => item.id)).toEqual(["parent"]);
    expect(filterTaskTree(tree, withBoth).map((item) => item.id)).toEqual(["parent", "simple"]);
    expect(toggleTaskFilter(withBoth, "with-steps")).toEqual(["simple"]);
  });
});
