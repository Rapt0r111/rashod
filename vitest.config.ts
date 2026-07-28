import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

const sourceTests = "src/tests/**/*.test.{ts,tsx}";
const componentTests = "src/tests/**/*.component.test.{ts,tsx}";
const integrationTests = "src/tests/**/*.integration.test.{ts,tsx}";
const commonExcludes = [
  "offline-transfer/**",
  "rashod-next-offline-win10/**",
  "offline-transfer-postgresql-win10/**",
];

export default defineConfig({
  plugins: [react()],
  resolve: {
    tsconfigPaths: true,
  },
  test: {
    exclude: commonExcludes,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html", "lcov"],
      reportsDirectory: "coverage",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/tests/**",
        "src/**/*.d.ts",
        "src/app/**/layout.tsx",
        "src/app/**/loading.tsx",
      ],
      thresholds: {
        statements: 13,
        lines: 13,
        functions: 13,
        branches: 12,
      },
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "node",
          include: [sourceTests],
          exclude: [...commonExcludes, componentTests, integrationTests],
        },
      },
      {
        extends: true,
        test: {
          name: "component",
          environment: "jsdom",
          environmentOptions: {
            jsdom: {
              url: "http://localhost/",
            },
          },
          include: [componentTests],
          exclude: commonExcludes,
          setupFiles: ["src/tests/setup/component.ts"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: [integrationTests],
          exclude: commonExcludes,
          setupFiles: ["src/tests/setup/integration.ts"],
          fileParallelism: false,
          maxConcurrency: 1,
        },
      },
    ],
  },
});
