if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required. Refusing to migrate an unspecified database.");
}
