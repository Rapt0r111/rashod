import { createAdministrator } from "./index";

const [username, displayName] = Bun.argv.slice(2);

async function readHiddenPassword() {
  if (!process.stdin.isTTY || !process.stdin.setRawMode) {
    throw new Error(
      "Interactive terminal required. Set RASHOD_ADMIN_PASSWORD for non-interactive provisioning.",
    );
  }
  process.stdout.write("Administrator password: ");
  process.stdin.setRawMode(true);
  process.stdin.resume();
  process.stdin.setEncoding("utf8");
  return new Promise<string>((resolve) => {
    let value = "";
    const finish = () => {
      process.stdin.off("data", onData);
      process.stdin.setRawMode(false);
      process.stdin.pause();
      process.stdout.write("\n");
      resolve(value);
    };
    const onData = (chunk: string) => {
      if (chunk === "\r" || chunk === "\n") return finish();
      if (chunk === "\u0003") process.exit(130);
      if (chunk === "\u007f" || chunk === "\b") {
        value = value.slice(0, -1);
        return;
      }
      value += chunk;
    };
    process.stdin.on("data", onData);
  });
}

if (!username)
  throw new Error("Usage: bun run auth:create-admin <username> [display-name]");
const password =
  process.env.RASHOD_ADMIN_PASSWORD ?? (await readHiddenPassword());
const user = await createAdministrator(username, password, displayName);
console.log(`Administrator ${user.username} created.`);
