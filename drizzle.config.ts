import { defineConfig } from "drizzle-kit";

// Generation is offline. The migration command itself checks DATABASE_URL
// before connecting, so this placeholder can never be used for a deployment.
const url = process.env.DATABASE_URL ?? "postgresql://invalid.invalid/rashod";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/postgres-schema.ts",
  out: "./drizzle",
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
