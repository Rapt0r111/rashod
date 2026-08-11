import { NextResponse } from "next/server";
import { getPostgresSnapshot as getSnapshot } from "@/server/db/postgres-roster-repository";
import { requirePermission } from "@/server/auth";
import { liveJson } from "@/server/cache/http";


export async function GET(request: Request) {
  const auth = await requirePermission(request, "roster:read");
  if (auth instanceof NextResponse) return auth;
  return liveJson(await getSnapshot());
}
