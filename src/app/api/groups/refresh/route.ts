import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/server/auth";
import { refreshPostgresAutomaticDutyAssignments as refreshAutomaticDutyAssignments } from "@/server/db/postgres-groups-repository";
import { publishRosterChanged } from "@/server/events";
import { apiError, parseJson, runAuditedMutation } from "@/server/http";
import { liveJson } from "@/server/cache/http";


const schema = z.object({ days: z.number().int().min(1).max(31).optional() });

export async function POST(request: Request) {
  const auth = await requirePermission(request, "groups:write");
  if (auth instanceof NextResponse) return auth;
  try {
    const input = await parseJson(request, schema);
    const snapshot = await runAuditedMutation(
      auth,
      "groups.refresh",
      () => refreshAutomaticDutyAssignments(input.days),
      { days: input.days ?? null },
    );
    publishRosterChanged("groups-refresh");
    return liveJson(snapshot);
  } catch (error) {
    return apiError(error);
  }
}
