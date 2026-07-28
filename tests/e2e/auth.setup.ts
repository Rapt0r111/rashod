import fs from "node:fs/promises";
import path from "node:path";
import { expect, request, test as setup } from "@playwright/test";

const password = "Rashod-e2e-2026!";
const users = [
  "admin",
  "roster-reader",
  "roster-writer",
  "groups-reader",
  "groups-writer",
  "tasks-reader",
  "tasks-writer",
  "no-access",
];

setup("authenticate test roles", async ({ baseURL }) => {
  const directory = path.resolve("playwright/.auth");
  await fs.mkdir(directory, { recursive: true });
  for (const username of users) {
    const context = await request.newContext({
      baseURL,
      extraHTTPHeaders: { origin: baseURL! },
    });
    const response = await context.post("/api/auth/login", {
      data: { username, password },
    });
    expect(
      response.ok(),
      `${username}: ${response.status()} ${await response.text()}`,
    ).toBe(true);
    await context.storageState({ path: path.join(directory, `${username}.json`) });
    await context.dispose();
  }
});
