import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/server/auth";
import { refreshPostgresAutomaticDutyAssignments as refreshAutomaticDutyAssignments } from "@/server/db/postgres-groups-repository";
import { publishRosterChanged } from "@/server/events";
import { apiError, dateKeyString, parseJson, runAuditedMutation } from "@/server/http";
import { liveJson } from "@/server/cache/http";
import { weekDates } from "@/features/groups/logic";


const schema = z.object({
  from: dateKeyString.optional(),
  to: dateKeyString.optional(),
  days: z.number().int().min(1).max(31).optional(),
});

export async function POST(request: Request) {
  const auth = await requirePermission(request, "groups:write");
  if (auth instanceof NextResponse) return auth;
  try {
    const input = await parseJson(request, schema);
    const horizon = weekDates(new Date(), input.days ?? 7);
    const from = input.from ?? horizon[0];
    const to = input.to ?? horizon[horizon.length - 1];
    const snapshot = await runAuditedMutation(
      auth,
      "groups.refresh",
      () => refreshAutomaticDutyAssignments(from, to),
      { from, to, days: input.days ?? null },
    );
    publishRosterChanged("groups-refresh");
    return liveJson(snapshot);
  } catch (error) {
    return apiError(error);
  }
}
