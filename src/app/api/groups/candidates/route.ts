import { NextResponse } from "next/server";
import { getPostgresGroupCandidates } from "@/server/db/postgres-groups-repository";
import { requirePermission } from "@/server/auth";
import { apiError, dateKeyString } from "@/server/http";
import { liveJson } from "@/server/cache/http";
import { scheduleDateRange } from "@/features/schedule/logic";

export async function GET(request: Request) {
  const auth = await requirePermission(request, "groups:read");
  if (auth instanceof NextResponse) return auth;
  try {
    const url = new URL(request.url);
    const groupId = url.searchParams.get("groupId")?.trim() ?? "";
    const from = url.searchParams.get("from") ?? "";
    const to = url.searchParams.get("to") ?? "";
    if (!groupId || !dateKeyString.safeParse(from).success || !dateKeyString.safeParse(to).success) {
      return liveJson({ error: "BAD_REQUEST" }, { status: 400 });
    }
    if (!scheduleDateRange(from, to)) {
      return liveJson({ error: "BAD_REQUEST" }, { status: 400 });
    }
    return liveJson(await getPostgresGroupCandidates(groupId, from, to));
  } catch (error) {
    return apiError(error);
  }
}
