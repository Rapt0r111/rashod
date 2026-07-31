import { fetchJson } from "@/lib/api-client";
import type { TasksSnapshot } from "./types";

export async function fetchTasksSnapshot(): Promise<TasksSnapshot> {
  return fetchJson<TasksSnapshot>("/api/tasks");
}

export async function saveTask(input: {
  title: string;
  description?: string;
  parentId?: string | null;
}) {
  return fetchJson<TasksSnapshot>("/api/tasks", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function updateTask(input: {
  id: string;
  title?: string;
  description?: string;
}) {
  return fetchJson<TasksSnapshot>("/api/tasks", {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export async function setTaskCompleted(id: string, completed: boolean) {
  return fetchJson<TasksSnapshot>("/api/tasks/complete", {
    method: "POST",
    body: JSON.stringify({ id, completed }),
  });
}
