export {};

const testDatabaseUrl = process.env.DATABASE_URL_TEST;

if (!testDatabaseUrl) {
  throw new Error(
    "DATABASE_URL_TEST is required for PostgreSQL integration tests.",
  );
}

if (testDatabaseUrl === process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL_TEST must differ from DATABASE_URL.");
}

let databaseName: string;

try {
  const databaseUrl = new URL(testDatabaseUrl);

  if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol)) {
    throw new Error("unsupported protocol");
  }

  databaseName = decodeURIComponent(databaseUrl.pathname)
    .replace(/^\//, "")
    .toLowerCase();
} catch {
  throw new Error("DATABASE_URL_TEST must be a valid PostgreSQL URL.");
}

if (!databaseName.includes("test")) {
  throw new Error('DATABASE_URL_TEST database name must contain "test".');
}

process.env.DATABASE_URL = testDatabaseUrl;
