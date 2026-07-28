import type { Task } from "./types";

export type TaskTreeItem = Task & { children: Task[] };
export type TaskFilter = "with-steps" | "simple";

export function taskTree(tasks: Task[]): TaskTreeItem[] {
  const byParent = new Map<string | null, Task[]>();
  const activeIds = new Set(tasks.map((task) => task.id));
  for (const task of tasks) {
    // A child remains actionable even if its parent has already moved to history.
    const parentId = task.parentId && activeIds.has(task.parentId) ? task.parentId : null;
    const items = byParent.get(parentId) ?? [];
    items.push(task);
    byParent.set(parentId, items);
  }
  const sorted = (items: Task[]) => [...items].sort((a, b) => a.sortOrder - b.sortOrder || b.createdAt - a.createdAt);
  return sorted(byParent.get(null) ?? []).map((task) => ({ ...task, children: sorted(byParent.get(task.id) ?? []) }));
}

export function taskProgress(task: Task, tasks: Task[]) {
  const children = tasks.filter((item) => item.parentId === task.id);
  if (!children.length) return null;
  return { total: children.length, complete: children.filter((item) => item.completedAt).length };
}

export function toggleTaskFilter(filters: TaskFilter[], filter: TaskFilter) {
  return filters.includes(filter)
    ? filters.filter((item) => item !== filter)
    : [...filters, filter];
}

export function filterTaskTree(tree: TaskTreeItem[], filters: TaskFilter[]) {
  if (filters.length === 0) return tree;
  return tree.filter((item) =>
    filters.some((filter) =>
      filter === "with-steps" ? item.children.length > 0 : item.children.length === 0,
    ),
  );
}
