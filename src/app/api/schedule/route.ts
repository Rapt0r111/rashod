import { NextResponse } from "next/server";
import { dateKeyString } from "@/server/http";
import { requireAnyPermission } from "@/server/auth";
import { defaultScheduleRange, scheduleDateRange } from "@/features/schedule/logic";
import { getPostgresScheduleSnapshot } from "@/server/db/postgres-schedule-repository";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAnyPermission(request, ["roster:read", "groups:read"]);
  if (auth instanceof NextResponse) return auth;

  const defaults = defaultScheduleRange();
  const params = new URL(request.url).searchParams;
  const from = params.get("from") ?? defaults.from;
  const to = params.get("to") ?? defaults.to;
  if (!dateKeyString.safeParse(from).success || !dateKeyString.safeParse(to).success || !scheduleDateRange(from, to)) {
    return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
  }

  return NextResponse.json(await getPostgresScheduleSnapshot(from, to), {
    headers: { "Cache-Control": "no-store" },
  });
}
