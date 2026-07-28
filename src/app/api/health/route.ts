import { NextResponse } from "next/server";
import { pg } from "@/server/db/postgres";
import { POSTGRES_MIGRATIONS } from "@/server/db/migrate-postgres";

export const dynamic = "force-dynamic";

/** Minimal non-sensitive readiness probe for LAN/offline startup checks. */
export async function GET() {
  try {
    const sql = pg();
    const [database, migration, schema] = await Promise.all([
      sql`SELECT 1 AS ok`,
      sql<Array<{ latestApplied: boolean }>>`
        SELECT EXISTS (
          SELECT 1 FROM schema_migrations
          WHERE name = ${POSTGRES_MIGRATIONS.at(-1)!}
        ) AS "latestApplied"
      `,
      sql<Array<{ usersTable: string | null; sessionsTable: string | null; auditTable: string | null }>>`
        SELECT
          to_regclass('public.users') AS "usersTable",
          to_regclass('public.sessions') AS "sessionsTable",
          to_regclass('public.auth_audit_events') AS "auditTable"
      `,
    ]);
    if (
      database[0]?.ok !== 1 ||
      !migration[0]?.latestApplied ||
      !schema[0]?.usersTable ||
      !schema[0]?.sessionsTable ||
      !schema[0]?.auditTable
    ) {
      return NextResponse.json({ ok: false }, { status: 503 });
    }
    return NextResponse.json(
      { ok: true },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
