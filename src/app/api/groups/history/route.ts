import { type NextRequest, NextResponse } from "next/server";
import { getPostgresDutyGroupHistory as getDutyGroupHistory } from "@/server/db/postgres-groups-repository";
import { requirePermission } from "@/server/auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const auth = await requirePermission(request, "groups:read");
  if (auth instanceof NextResponse) return auth;
  return NextResponse.json(
    await getDutyGroupHistory(
      request.nextUrl.searchParams.get("groupId") ?? undefined,
    ),
    {
      headers: { "Cache-Control": "no-store" },
    },
  );
}
