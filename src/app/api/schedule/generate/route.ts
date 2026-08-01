import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/server/auth";
import {
  dateKeyString,
  idString,
  parseJson,
  runAuditedMutation,
  uniqueArray,
} from "@/server/http";
import { publishRosterChanged } from "@/server/events";
import { scheduleDateRange } from "@/features/schedule/logic";
import { getPostgresScheduleSnapshot } from "@/server/db/postgres-schedule-repository";
import { materializePostgresAutomaticDutyAssignments } from "@/server/db/postgres-groups-repository";

export const dynamic = "force-dynamic";

const schema = z.object({
  from: dateKeyString,
  to: dateKeyString,
  groupIds: uniqueArray(idString, 64).optional(),
});

export async function POST(request: Request) {
  const auth = await requirePermission(request, "groups:write");
  if (auth instanceof NextResponse) return auth;
  try {
    const input = await parseJson(request, schema);
    if (!scheduleDateRange(input.from, input.to)) {
      return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
    }
    const snapshot = await runAuditedMutation(
      auth,
      "groups.schedule.generated",
      async () => {
        await materializePostgresAutomaticDutyAssignments(input.from, input.to, input.groupIds);
        return getPostgresScheduleSnapshot(input.from, input.to);
      },
      { from: input.from, to: input.to, groupIds: input.groupIds ?? [] },
    );
    publishRosterChanged("groups");
    return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof z.ZodError) return NextResponse.json({ error: "BAD_REQUEST" }, { status: 400 });
    const message = error instanceof Error ? error.message : "";
    if (message === "BAD_REQUEST") return NextResponse.json({ error: message }, { status: 400 });
    console.error("Schedule generation failed", error);
    return NextResponse.json({ error: "INTERNAL_ERROR" }, { status: 500 });
  }
}
