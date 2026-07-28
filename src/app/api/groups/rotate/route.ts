import { NextResponse } from "next/server";
import { z } from "zod";
import { rotatePostgresDutyGroup as rotateDutyGroup } from "@/server/db/postgres-groups-repository";
import { publishRosterChanged } from "@/server/events";
import { requirePermission } from "@/server/auth";
import { apiError, dateString, idString, parseJson, runAuditedMutation } from "@/server/http";

export const dynamic = "force-dynamic";

const schema = z.object({
  groupId: idString,
  date: dateString.optional(),
});

export async function POST(request: Request) {
  const auth = await requirePermission(request, "groups:write");
  if (auth instanceof NextResponse) return auth;
  try {
    const { groupId, date } = await parseJson(request, schema);
    const snapshot = await runAuditedMutation(
      auth,
      "groups.rotated",
      () => rotateDutyGroup(groupId, date),
      { groupId, date: date ?? null },
    );
    publishRosterChanged("groups");
    return NextResponse.json(snapshot);
  } catch (error) {
    return apiError(error);
  }
}
