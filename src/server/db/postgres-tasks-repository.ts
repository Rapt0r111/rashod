import { randomUUID } from "node:crypto";
import type { Task, TasksSnapshot } from "@/features/tasks/types";
import { inPostgresTransaction, pg } from "./postgres";

type DbTask = Omit<Task, "completedAt" | "createdAt" | "updatedAt"> & { completed_at: Date | null; created_at: Date; updated_at: Date };
const task = (row: DbTask): Task => ({ ...row, completedAt: row.completed_at?.getTime() ?? null, createdAt: row.created_at.getTime(), updatedAt: row.updated_at.getTime() });
const selectTasks = () => pg()<DbTask[]>`SELECT id, parent_id AS "parentId", title, description, sort_order AS "sortOrder", completed_at, created_at, updated_at FROM tasks ORDER BY completed_at NULLS FIRST, sort_order, created_at DESC`;

export async function getPostgresTasksSnapshot(): Promise<TasksSnapshot> {
  const rows = (await selectTasks()).map(task);
  const activeParentIds = new Set(
    rows.filter((item) => !item.parentId && !item.completedAt).map((item) => item.id),
  );
  // A finished subtask remains visible under its active parent.
  const active = rows.filter(
    (item) => !item.completedAt || (!!item.parentId && activeParentIds.has(item.parentId)),
  );
  return { active, history: rows.filter((item) => !active.includes(item)) };
}

export async function createPostgresTask(input: { title: string; description?: string; parentId?: string | null }) {
  const title = input.title.trim();
  if (!title) throw new Error("TASK_TITLE_REQUIRED");
  const id = randomUUID();
  await inPostgresTransaction(async (transaction) => {
    if (input.parentId) {
      const parent = await transaction`SELECT id FROM tasks WHERE id = ${input.parentId} AND parent_id IS NULL AND completed_at IS NULL`;
      if (!parent.length) throw new Error("PARENT_TASK_NOT_FOUND");
    }
    await transaction`INSERT INTO tasks (id, parent_id, title, description, sort_order) VALUES (${id}, ${input.parentId ?? null}, ${title}, ${input.description?.trim() ?? ""}, ${Date.now()})`;
  });
  return getPostgresTasksSnapshot();
}

export async function updatePostgresTask(input: { id: string; title?: string; description?: string }) {
  if (input.title !== undefined && !input.title.trim()) throw new Error("TASK_TITLE_REQUIRED");
  const updated = await pg()`UPDATE tasks SET title = COALESCE(${input.title?.trim() ?? null}, title), description = COALESCE(${input.description?.trim() ?? null}, description), updated_at = now() WHERE id = ${input.id} AND completed_at IS NULL RETURNING id`;
  if (!updated.length) throw new Error("TASK_NOT_EDITABLE");
  return getPostgresTasksSnapshot();
}

export async function setPostgresTaskCompleted(id: string, completed: boolean) {
  await inPostgresTransaction(async (transaction) => {
    const found = await transaction<{ id: string; parent_id: string | null; completed_at: Date | null }[]>`SELECT id, parent_id, completed_at FROM tasks WHERE id = ${id} FOR UPDATE`;
    const current = found[0];
    if (!current) throw new Error("TASK_NOT_FOUND");
    if (completed === !!current.completed_at) return;
    if (!completed) {
      if (current.parent_id)
        await transaction`UPDATE tasks SET completed_at = NULL, updated_at = now() WHERE id = ${current.parent_id}`;
      await transaction`UPDATE tasks SET completed_at = NULL, updated_at = now() WHERE id = ${id}`;
      return;
    }
    if (current.parent_id) {
      await transaction`UPDATE tasks SET completed_at = now(), updated_at = now() WHERE id = ${id} AND completed_at IS NULL`;
      return;
    }
    await transaction`WITH RECURSIVE descendants AS (SELECT id FROM tasks WHERE id = ${id} UNION ALL SELECT tasks.id FROM tasks INNER JOIN descendants ON tasks.parent_id = descendants.id) UPDATE tasks SET completed_at = now(), updated_at = now() WHERE id IN (SELECT id FROM descendants) AND completed_at IS NULL`;
  });
  return getPostgresTasksSnapshot();
}
