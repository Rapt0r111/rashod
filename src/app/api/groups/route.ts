import { NextResponse } from "next/server";
import { z } from "zod";
import {
  createPostgresDutyGroup as createDutyGroup,
  deletePostgresDutyGroup as deleteDutyGroup,
  getPostgresGroupsSnapshot as getGroupsSnapshot,
  updatePostgresDutyGroup as updateDutyGroup,
} from "@/server/db/postgres-groups-repository";
import { publishRosterChanged } from "@/server/events";
import { requirePermission } from "@/server/auth";
import { apiError, idString, optionalText, parseJson, runAuditedMutation, shortText } from "@/server/http";
import { liveJson } from "@/server/cache/http";


const createSchema = z.object({
  name: shortText(120),
  templateId: idString,
  notes: optionalText(1_000),
});
const updateSchema = z.object({
  id: idString,
  expectedUpdatedAt: z.number().int().nonnegative().optional(),
  name: shortText(120).optional(),
  templateId: idString.optional(),
  notes: optionalText(1_000),
  enabled: z.boolean().optional(),
});
const deleteSchema = z.object({ id: idString });

export async function GET(request: Request) {
  const auth = await requirePermission(request, "groups:read");
  if (auth instanceof NextResponse) return auth;
  return liveJson(await getGroupsSnapshot());
}

export async function POST(request: Request) {
  const auth = await requirePermission(request, "groups:write");
  if (auth instanceof NextResponse) return auth;
  try {
    const input = await parseJson(request, createSchema);
    const snapshot = await runAuditedMutation(
      auth,
      "groups.created",
      () => createDutyGroup(input),
      { name: input.name, templateId: input.templateId },
    );
    publishRosterChanged("groups");
    return NextResponse.json(snapshot);
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  const auth = await requirePermission(request, "groups:write");
  if (auth instanceof NextResponse) return auth;
  try {
    const input = await parseJson(request, updateSchema);
    const snapshot = await runAuditedMutation(
      auth,
      "groups.updated",
      () => updateDutyGroup(input),
      { groupId: input.id },
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
    const { id } = await parseJson(request, deleteSchema);
    const snapshot = await runAuditedMutation(
      auth,
      "groups.deleted",
      () => deleteDutyGroup(id),
      { groupId: id },
    );
    publishRosterChanged("groups");
    return NextResponse.json(snapshot);
  } catch (error) {
    return apiError(error);
  }
}
