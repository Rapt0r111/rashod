import type { TasksSnapshot } from "./types";

async function fetchTaskJson<T>(
  url: string,
  init: RequestInit | undefined,
  fallbackError: string,
): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      window.location.assign("/");
    }
    const payload = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;
    throw new Error(payload?.error ?? fallbackError);
  }
  return response.json() as Promise<T>;
}

export async function fetchTasksSnapshot(): Promise<TasksSnapshot> {
  return fetchTaskJson<TasksSnapshot>("/api/tasks", undefined, "TASKS_LOAD_FAILED");
}

export async function saveTask(input: { title: string; description?: string; parentId?: string | null }) {
  return fetchTaskJson<TasksSnapshot>(
    "/api/tasks",
    { method: "POST", body: JSON.stringify(input) },
    "TASK_SAVE_FAILED",
  );
}

export async function updateTask(input: { id: string; title?: string; description?: string }) {
  return fetchTaskJson<TasksSnapshot>(
    "/api/tasks",
    { method: "PUT", body: JSON.stringify(input) },
    "TASK_UPDATE_FAILED",
  );
}

export async function setTaskCompleted(id: string, completed: boolean) {
  return fetchTaskJson<TasksSnapshot>(
    "/api/tasks/complete",
    { method: "POST", body: JSON.stringify({ id, completed }) },
    "TASK_COMPLETION_FAILED",
  );
}
