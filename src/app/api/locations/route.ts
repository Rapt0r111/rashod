import { NextResponse } from "next/server";
import { z } from "zod";
import {
  deletePostgresLocation as deleteLocation,
  getPostgresSnapshot as getSnapshot,
  upsertPostgresLocation as upsertLocation,
} from "@/server/db/postgres-roster-repository";
import { publishRosterChanged } from "@/server/events";
import { requirePermission } from "@/server/auth";
import { apiError, idString, optionalIdString, parseJson, runAuditedMutation, shortText, sortOrder } from "@/server/http";

const schema = z.object({
  id: optionalIdString,
  key: optionalIdString,
  label: shortText(120),
  colorToken: z.string().trim().min(1).max(32).optional(),
  isQuick: z.boolean().optional(),
  quickCode: z.string().trim().min(1).max(16).nullable().optional(),
  countsAsPresent: z.boolean().optional(),
  sortOrder,
  isSystem: z.boolean().optional(),
});


export async function POST(request: Request) {
  const auth = await requirePermission(request, "references:manage");
  if (auth instanceof NextResponse) return auth;
  try {
    const input = await parseJson(request, schema);
    const snapshot = await runAuditedMutation(
      auth,
      "reference.location.saved",
      async () => {
        await upsertLocation(input);
        return getSnapshot();
      },
      { id: input.id ?? null, key: input.key ?? null, label: input.label },
    );
    publishRosterChanged("locations");
    return NextResponse.json(snapshot);
  } catch (error) {
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
      "reference.location.deleted",
      async () => {
        await deleteLocation(id);
        return getSnapshot();
      },
      { id },
    );
    publishRosterChanged("locations");
    return NextResponse.json(snapshot);
  } catch (error) {
    return apiError(error);
  }
}
