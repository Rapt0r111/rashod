import { defineConfig, devices } from "@playwright/test";

const full = process.env.E2E_FULL_BROWSERS === "true";

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "test-results",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI
    ? [["line"], ["html", { open: "never" }]]
    : "list",
  use: {
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  webServer: {
    command: "bun --bun run scripts/start-e2e.ts",
    url: "http://127.0.0.1:3100/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: "setup", testMatch: /auth\.setup\.ts/ },
    { name: "api", testMatch: /api\.spec\.ts/, dependencies: ["setup"] },
    {
      name: "chromium",
      testIgnore: [/auth\.setup\.ts/, /api\.spec\.ts/],
      use: {
        ...devices["Desktop Chrome"],
        storageState: "playwright/.auth/admin.json",
      },
      dependencies: ["setup"],
    },
    ...(full
      ? [
          {
            name: "firefox",
            testIgnore: [/auth\.setup\.ts/, /api\.spec\.ts/],
            use: { ...devices["Desktop Firefox"], storageState: "playwright/.auth/admin.json" },
            dependencies: ["setup"],
          },
          {
            name: "webkit",
            testIgnore: [/auth\.setup\.ts/, /api\.spec\.ts/],
            use: { ...devices["Desktop Safari"], storageState: "playwright/.auth/admin.json" },
            dependencies: ["setup"],
          },
          {
            name: "mobile-chromium",
            testIgnore: [/auth\.setup\.ts/, /api\.spec\.ts/],
            use: { ...devices["Pixel 7"], storageState: "playwright/.auth/admin.json" },
            dependencies: ["setup"],
          },
        ]
      : []),
  ],
});
