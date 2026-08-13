import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/server/auth";
import { upsertPersonnelProfile } from "@/server/db/postgres-zgt-repository";
import { apiError, idString, optionalText, parseJson, runAuditedMutation } from "@/server/http";
import { publishRosterChanged } from "@/server/events";


const profileSchema = z.object({
  personId: idString,
  lastName: optionalText(64),
  firstName: optionalText(64),
  middleName: optionalText(64),
  position: optionalText(128),
  unit: optionalText(128),
  notes: z.string().trim().max(2000).optional(),
});

export async function POST(request: Request) {
  const auth = await requirePermission(request, "zgt:write");
  if (auth instanceof NextResponse) return auth;

  try {
    const input = await parseJson(request, profileSchema);
    await runAuditedMutation(
      auth,
      "zgt.personnel_profile.saved",
      () =>
        upsertPersonnelProfile({
          personId: input.personId,
          lastName: input.lastName ?? null,
          firstName: input.firstName ?? null,
          middleName: input.middleName ?? null,
          position: input.position ?? null,
          unit: input.unit ?? null,
          notes: input.notes,
        }),
      { personId: input.personId },
    );
    publishRosterChanged("zgt");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
