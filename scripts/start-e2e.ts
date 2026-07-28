import { spawn } from "node:child_process";
import { assertTestDatabaseUrl } from "../test-support/database";

const databaseUrl = assertTestDatabaseUrl();
const child = spawn(
  process.execPath,
  ["--bun", "next", "start", "--hostname", "127.0.0.1", "--port", "3100"],
  {
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      AUTH_ALLOW_INSECURE_LAN: "true",
    },
    stdio: "inherit",
  },
);

child.once("error", (error) => {
  console.error(error);
  process.exit(1);
});
child.once("exit", (code, signal) => process.exit(signal ? 1 : (code ?? 1)));
