import { AsyncLocalStorage } from "node:async_hooks";
import postgres from "postgres";

let client: ReturnType<typeof postgres> | null = null;
const transactionContext = new AsyncLocalStorage<postgres.TransactionSql>();

function rootClient() {
  if (client) return client;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is required for the PostgreSQL runtime");
  client = postgres(url, { max: 10, idle_timeout: 20, connect_timeout: 10 });
  return client;
}

export function pg(): ReturnType<typeof postgres> {
  return (transactionContext.getStore() ?? rootClient()) as ReturnType<typeof postgres>;
}

export async function inPostgresTransaction<T>(
  callback: (transaction: postgres.TransactionSql) => Promise<T>,
): Promise<T> {
  const current = transactionContext.getStore();
  if (current) return callback(current);
  const result = await rootClient().begin((transaction) =>
    transactionContext.run(transaction, async () => ({ value: await callback(transaction) })),
  );
  return result.value;
}
