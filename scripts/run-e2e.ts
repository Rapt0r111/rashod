import { resolveOrProvisionTestDatabase } from "../test-support/database";

const full = process.argv.includes("--full");
const passthrough = process.argv.slice(2).filter((argument) => argument !== "--full");
const testUrl = await resolveOrProvisionTestDatabase();
const env = {
  ...process.env,
  DATABASE_URL_TEST: testUrl,
  E2E_FULL_BROWSERS: full ? "true" : "false",
};

async function run(args: string[], executable = process.execPath) {
  const child = Bun.spawn([executable, ...args], {
    env,
    stdout: "inherit",
    stderr: "inherit",
    stdin: "inherit",
  });
  const code = await child.exited;
  if (code !== 0) process.exit(code);
}

await run(["--bun", "run", "scripts/reset-test-db.ts"]);
await run(["--bun", "run", "build"]);
await run(
  ["node_modules/@playwright/test/cli.js", "test", ...passthrough],
  Bun.which("node") ?? "node",
);
