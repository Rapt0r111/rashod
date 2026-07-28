import { NextResponse } from "next/server";
import { getPostgresSnapshot as getSnapshot } from "@/server/db/postgres-roster-repository";
import { requirePermission } from "@/server/auth";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requirePermission(request, "roster:read");
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json(await getSnapshot(), {
    headers: { "Cache-Control": "no-store" },
  });
}
