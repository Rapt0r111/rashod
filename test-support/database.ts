import postgres from "postgres";

export function assertTestDatabaseUrl(value = process.env.DATABASE_URL_TEST) {
  if (!value) throw new Error("DATABASE_URL_TEST is required for database tests.");
  const url = new URL(value);
  const database = decodeURIComponent(url.pathname.replace(/^\//, ""));
  if (!database || !/test/i.test(database)) {
    throw new Error(`Refusing to use non-test database: ${database || "<empty>"}`);
  }
  const runtimeUrl = process.env.DATABASE_URL;
  if (runtimeUrl && normalizeDatabaseUrl(runtimeUrl) === normalizeDatabaseUrl(value)) {
    throw new Error("DATABASE_URL_TEST must not point to DATABASE_URL.");
  }
  return value;
}

export async function resolveOrProvisionTestDatabase() {
  if (process.env.DATABASE_URL_TEST) return assertTestDatabaseUrl();
  const source = process.env.DATABASE_URL;
  if (!source) throw new Error("Set DATABASE_URL_TEST or DATABASE_URL before running E2E tests.");
  const sourceUrl = new URL(source);
  const sourceName = decodeURIComponent(sourceUrl.pathname.replace(/^\//, ""));
  const targetName = `${sourceName.replace(/_test$/i, "")}_test`;
  if (!/^[a-zA-Z0-9_-]+$/.test(targetName) || !/test/i.test(targetName)) {
    throw new Error("Could not derive a safe test database name.");
  }
  const adminUrl = new URL(sourceUrl);
  adminUrl.pathname = "/postgres";
  const admin = postgres(adminUrl.toString(), { max: 1 });
  try {
    const existing = await admin<{ exists: boolean }[]>`
      SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname = ${targetName}) AS exists
    `;
    if (!existing[0]?.exists) await admin.unsafe(`CREATE DATABASE "${targetName}"`);
  } finally {
    await admin.end({ timeout: 5 });
  }
  const targetUrl = new URL(sourceUrl);
  targetUrl.pathname = `/${targetName}`;
  process.env.DATABASE_URL_TEST = targetUrl.toString();
  return assertTestDatabaseUrl(targetUrl.toString());
}

function normalizeDatabaseUrl(value: string) {
  const url = new URL(value);
  url.search = "";
  url.hash = "";
  return url.toString();
}
