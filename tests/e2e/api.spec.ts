import path from "node:path";
import { expect, request, test } from "@playwright/test";

test.describe.configure({ mode: "serial" });

async function apiAs(baseURL: string, username?: string, includeOrigin = true) {
  return request.newContext({
    baseURL,
    storageState: username
      ? path.resolve(`playwright/.auth/${username}.json`)
      : undefined,
    extraHTTPHeaders: includeOrigin ? { origin: baseURL } : undefined,
  });
}

test("health proves database readiness without leaking details", async ({ baseURL }) => {
  const api = await apiAs(baseURL!);
  const response = await api.get("/api/health");
  expect(response.status()).toBe(200);
  await expect(response.json()).resolves.toEqual({ ok: true });
  await api.dispose();
});

test("authentication and RBAC protect read and write surfaces", async ({ baseURL }) => {
  const anonymous = await apiAs(baseURL!);
  expect((await anonymous.get("/api/snapshot")).status()).toBe(401);
  await anonymous.dispose();

  const reader = await apiAs(baseURL!, "roster-reader");
  expect((await reader.get("/api/snapshot")).status()).toBe(200);
  const forbidden = await reader.post("/api/location-change", {
    data: { personId: "person-vz1-01", to: "otpusk" },
  });
  expect(forbidden.status()).toBe(403);
  await expect(forbidden.json()).resolves.toEqual({ error: "FORBIDDEN" });
  await reader.dispose();

  const noAccess = await apiAs(baseURL!, "no-access");
  expect((await noAccess.get("/api/snapshot")).status()).toBe(403);
  await noAccess.dispose();
});

test("mutation boundaries reject CSRF, media type and malformed JSON", async ({ baseURL }) => {
  const noOrigin = await apiAs(baseURL!, "admin", false);
  const csrf = await noOrigin.post("/api/people", {
    data: { name: "Тест", rank: "рядовой", platoonId: "platoon-vz1" },
  });
  expect(csrf.status()).toBe(403);
  await expect(csrf.json()).resolves.toEqual({ error: "CSRF_REJECTED" });
  await noOrigin.dispose();

  const admin = await apiAs(baseURL!, "admin");
  const media = await admin.post("/api/people", {
    headers: { "content-type": "text/plain" },
    data: "{}",
  });
  expect(media.status()).toBe(415);
  await expect(media.json()).resolves.toEqual({ error: "UNSUPPORTED_MEDIA_TYPE" });

  const malformed = await admin.post("/api/people", {
    headers: { "content-type": "application/json" },
    data: "{",
  });
  expect(malformed.status()).toBe(400);
  await expect(malformed.json()).resolves.toEqual({ error: "BAD_REQUEST" });
  await admin.dispose();
});

test("typed other location is stored without creating a catalog row", async ({ baseURL }) => {
  const admin = await apiAs(baseURL!, "admin");
  const before = await (await admin.get("/api/snapshot")).json();
  const person = before.people[0] as { id: string; location: string };
  const catalogCount = (before.locations as unknown[]).length;
  const typed = `Другое e2e ${Date.now()}`;

  const empty = await admin.post("/api/location-change", {
    data: { personId: person.id, to: "   " },
  });
  expect(empty.status()).toBe(400);

  const response = await admin.post("/api/location-change", {
    data: { personId: person.id, to: typed },
  });
  expect(response.status()).toBe(200);
  const after = await response.json();
  expect(after.people.find((item: { id: string }) => item.id === person.id).location).toBe(typed);
  expect(after.locations).toHaveLength(catalogCount);
  expect(
    after.locations.some(
      (item: { key: string; label: string }) => item.key === typed || item.label === typed,
    ),
  ).toBe(false);

  await admin.post("/api/location-change", {
    data: { personId: person.id, to: person.location },
  });
  await admin.dispose();
});

test("excluded person cannot be assigned manually", async ({ baseURL }) => {
  const writer = await apiAs(baseURL!, "groups-writer");
  const response = await writer.post("/api/groups/assign", {
    data: {
      groupId: "group-e2e",
      personId: "person-vz1-01",
      date: "2026-07-20",
    },
  });
  expect(response.status()).toBe(409);
  await expect(response.json()).resolves.toMatchObject({
    error: "GROUP_ASSIGNMENT_INELIGIBLE",
    reason: "excluded",
  });
  await writer.dispose();
});

test("tasks writer completes a full create-update-complete round trip", async ({ baseURL }) => {
  const writer = await apiAs(baseURL!, "tasks-writer");
  const title = `E2E task ${Date.now()}`;
  const createdResponse = await writer.post("/api/tasks", {
    data: { title, description: "API round trip" },
  });
  expect(createdResponse.status()).toBe(200);
  const created = await createdResponse.json();
  const task = created.active.find((item: { title: string }) => item.title === title) as { id: string } | undefined;
  expect(task?.id).toBeTruthy();
  if (!task) throw new Error("Created task is missing from the active task list");

  const updatedResponse = await writer.put("/api/tasks", {
    data: { id: task.id, title: `${title} updated` },
  });
  expect(updatedResponse.status()).toBe(200);

  const completedResponse = await writer.post("/api/tasks/complete", {
    data: { id: task.id, completed: true },
  });
  expect(completedResponse.status()).toBe(200);
  const completed = await completedResponse.json();
  const completedTask = completed.history.find((item: { id: string }) => item.id === task.id) as { completedAt: number | null } | undefined;
  expect(completedTask).toBeDefined();
  if (!completedTask) throw new Error("Completed task is missing from task history");
  expect(completedTask.completedAt).not.toBeNull();
  await writer.dispose();
});

test("unsupported methods use the framework 405 contract", async ({ baseURL }) => {
  const admin = await apiAs(baseURL!, "admin");
  expect((await admin.patch("/api/snapshot", { data: {} })).status()).toBe(405);
  await admin.dispose();
});
