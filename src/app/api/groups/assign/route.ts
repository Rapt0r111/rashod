import { NextResponse } from "next/server";
import { z } from "zod";
import {
  assignPostgresPersonToDutyGroup as assignPersonToDutyGroup,
  GroupAssignmentIneligibleError,
  removePostgresDutyAssignment as removeDutyAssignment,
} from "@/server/db/postgres-groups-repository";
import { publishRosterChanged } from "@/server/events";
import { requirePermission } from "@/server/auth";
import { apiError, dateString, idString, parseJson, runAuditedMutation } from "@/server/http";

export const dynamic = "force-dynamic";

const postSchema = z.object({
  groupId: idString,
  personId: idString,
  date: dateString.optional(),
  allowConflict: z.boolean().optional(),
});
const deleteSchema = z.object({ assignmentId: idString });

export async function POST(request: Request) {
  const auth = await requirePermission(request, "groups:write");
  if (auth instanceof NextResponse) return auth;
  try {
    const { groupId, personId, date, allowConflict } = await parseJson(request, postSchema);
    const snapshot = await runAuditedMutation(
      auth,
      "groups.assignment.created",
      () => assignPersonToDutyGroup(groupId, personId, date, allowConflict ?? false),
      { personId, groupId, date, allowConflict: allowConflict ?? false },
    );
    publishRosterChanged("groups");
    return NextResponse.json(snapshot);
  } catch (error) {
    const maybeConflict = error as Error & { conflicts?: unknown };
    if (error instanceof GroupAssignmentIneligibleError) return apiError(error, { extra: { reason: error.reason } });
    return apiError(error, { extra: maybeConflict.message === "GROUP_ASSIGNMENT_CONFLICT" ? { conflicts: maybeConflict.conflicts ?? [] } : undefined });
  }
}

export async function DELETE(request: Request) {
  const auth = await requirePermission(request, "groups:write");
  if (auth instanceof NextResponse) return auth;
  try {
    const { assignmentId } = await parseJson(request, deleteSchema);
    const snapshot = await runAuditedMutation(
      auth,
      "groups.assignment.deleted",
      () => removeDutyAssignment(assignmentId),
      { assignmentId },
    );
    publishRosterChanged("groups");
    return NextResponse.json(snapshot);
  } catch (error) {
    return apiError(error);
  }
}
