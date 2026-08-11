import { NextResponse } from "next/server";
import { z } from "zod";
import {
  deletePostgresPerson as deletePerson,
  getPostgresSnapshot as getSnapshot,
  upsertPostgresPerson as upsertPerson,
} from "@/server/db/postgres-roster-repository";
import { publishRosterChanged } from "@/server/events";
import { requirePermission } from "@/server/auth";
import { apiError, idString, optionalIdString, parseJson, runAuditedMutation, shortText, sortOrder } from "@/server/http";

const personSchema = z.object({
  id: optionalIdString,
  name: shortText(160),
  rank: shortText(80),
  conscriptionNumber: z.string().trim().max(40).optional().nullable(),
  platoonId: idString,
  location: z.string().trim().min(1).max(120).optional(),
  sortOrder,
});


export async function POST(request: Request) {
  const auth = await requirePermission(request, "references:manage");
  if (auth instanceof NextResponse) return auth;
  try {
    const input = await parseJson(request, personSchema);
    const snapshot = await runAuditedMutation(
      auth,
      "reference.person.saved",
      async () => {
        await upsertPerson(input);
        return getSnapshot();
      },
      { personId: input.id ?? null, platoonId: input.platoonId, conscriptionNumber: input.conscriptionNumber?.trim() || null, location: input.location ?? null },
    );
    publishRosterChanged("people");
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
      "reference.person.deleted",
      async () => {
        await deletePerson(id);
        return getSnapshot();
      },
      { personId: id },
    );
    publishRosterChanged("people");
    return NextResponse.json(snapshot);
  } catch (error) {
    return apiError(error);
  }
}
