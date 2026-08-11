import { NextResponse } from "next/server";
import { z } from "zod";
import {
  excludePostgresPersonFromDutyGroup as excludePersonFromDutyGroup,
  includePostgresPersonInDutyGroup as includePersonInDutyGroup,
} from "@/server/db/postgres-groups-repository";
import { publishRosterChanged } from "@/server/events";
import { requirePermission } from "@/server/auth";
import { apiError, idString, optionalText, parseJson, runAuditedMutation } from "@/server/http";


const postSchema = z.object({
  groupId: idString,
  personId: idString,
  dayOfWeek: z.number().int().min(0).max(6).nullable().optional(),
  reason: optionalText(500),
});
const deleteSchema = z.object({ exclusionId: idString });

export async function POST(request: Request) {
  const auth = await requirePermission(request, "groups:write");
  if (auth instanceof NextResponse) return auth;
  try {
    const { groupId, personId, dayOfWeek, reason } = await parseJson(request, postSchema);
    const snapshot = await runAuditedMutation(
      auth,
      "groups.exclusion.created",
      () => excludePersonFromDutyGroup(groupId, personId, dayOfWeek ?? null, reason ?? ""),
      { personId, groupId, dayOfWeek: dayOfWeek ?? null },
    );
    publishRosterChanged("groups");
    return NextResponse.json(snapshot);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  const auth = await requirePermission(request, "groups:write");
  if (auth instanceof NextResponse) return auth;
  try {
    const { exclusionId } = await parseJson(request, deleteSchema);
    const snapshot = await runAuditedMutation(
      auth,
      "groups.exclusion.deleted",
      () => includePersonInDutyGroup(exclusionId),
      { exclusionId },
    );
    publishRosterChanged("groups");
    return NextResponse.json(snapshot);
  } catch (error) {
    return apiError(error);
  }
}
