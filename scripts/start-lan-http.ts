import { spawn } from "node:child_process";

const host = process.env.RASHOD_LAN_HOST?.trim() || "0.0.0.0";
const port = process.env.RASHOD_PORT?.trim() || process.env.PORT?.trim() || "3000";

const child = spawn(
  process.execPath,
  ["--bun", "next", "start", "--hostname", host, "--port", port],
  {
    env: {
      ...process.env,
      AUTH_ALLOW_INSECURE_LAN: "true",
    },
    stdio: "inherit",
  },
);

child.once("error", (error) => {
  console.error(`Failed to start LAN HTTP server: ${error.message}`);
  process.exit(1);
});

child.once("exit", (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code ?? 1);
});
