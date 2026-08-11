import { NextResponse } from "next/server";
import { z } from "zod";
import {
  LocationGroupMembershipConflictError,
  deletePostgresLocationGroup as deleteLocationGroup,
  upsertPostgresLocationGroup as upsertLocationGroup,
} from "@/server/db/postgres-roster-repository";
import { publishRosterChanged } from "@/server/events";
import { requirePermission } from "@/server/auth";
import { apiError, idString, optionalIdString, parseJson, runAuditedMutation, shortText, sortOrder, uniqueArray } from "@/server/http";

const colorTokens = ["neutral", "green", "blue", "amber", "cyan", "red", "violet"] as const;
const groupSchema = z.object({
  id: optionalIdString,
  label: shortText(120),
  colorToken: z.enum(colorTokens).optional(),
  enabled: z.boolean().optional(),
  sortOrder,
  locationKeys: uniqueArray(idString, 200).default([]),
  allowTransfer: z.boolean().optional(),
});


export async function POST(request: Request) {
  const auth = await requirePermission(request, "references:manage");
  if (auth instanceof NextResponse) return auth;
  try {
    const input = await parseJson(request, groupSchema);
    const snapshot = await runAuditedMutation(
      auth,
      "reference.location_group.saved",
      () => upsertLocationGroup(input),
      { id: input.id ?? null, label: input.label },
    );
    publishRosterChanged("location-groups");
    return NextResponse.json(snapshot);
  } catch (error) {
    if (error instanceof LocationGroupMembershipConflictError) {
      return apiError(error, { status: 409, extra: { conflicts: error.conflicts } });
    }
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  const auth = await requirePermission(request, "references:manage");
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await parseJson(request, z.object({ id: idString }));
    const snapshot = await runAuditedMutation(
      auth,
      "reference.location_group.deleted",
      () => deleteLocationGroup(id),
      { id },
    );
    publishRosterChanged("location-groups");
    return NextResponse.json(snapshot);
  } catch (error) {
    return apiError(error);
  }
}
