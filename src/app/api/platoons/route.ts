import { NextResponse } from "next/server";
import { z } from "zod";
import {
  deletePostgresPlatoon as deletePlatoon,
  getPostgresSnapshot as getSnapshot,
  upsertPostgresPlatoon as upsertPlatoon,
} from "@/server/db/postgres-roster-repository";
import { publishRosterChanged } from "@/server/events";
import { requireAnyPermission, requirePermission } from "@/server/auth";
import { apiError, optionalIdString, parseJson, runAuditedMutation, shortText, sortOrder } from "@/server/http";

const schema = z.object({
  id: optionalIdString,
  key: optionalIdString,
  label: shortText(120),
  sortOrder,
  isSystem: z.boolean().optional(),
});

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const auth = await requireAnyPermission(request, ["roster:read", "references:manage"]);
  if (auth instanceof NextResponse) return auth;
  const snapshot = await getSnapshot();
  return NextResponse.json(snapshot.platoons, {
    headers: { "Cache-Control": "no-store" },
  });
}

export async function POST(request: Request) {
  const auth = await requirePermission(request, "references:manage");
  if (auth instanceof NextResponse) return auth;
  try {
    const input = await parseJson(request, schema);
    const snapshot = await runAuditedMutation(
      auth,
      "reference.platoon.saved",
      async () => {
        await upsertPlatoon(input);
        return getSnapshot();
      },
      { id: input.id ?? null, key: input.key ?? null, label: input.label },
    );
    publishRosterChanged("platoons");
    return NextResponse.json(snapshot);
  } catch (error) {
    return apiError(error);
  }
}

export async function DELETE(request: Request) {
  const auth = await requirePermission(request, "references:manage");
  if (auth instanceof NextResponse) return auth;
  try {
    const { id } = await parseJson(request, z.object({ id: z.string().trim().min(1).max(128) }));
    const snapshot = await runAuditedMutation(
      auth,
      "reference.platoon.deleted",
      async () => {
        await deletePlatoon(id);
        return getSnapshot();
      },
      { id },
    );
    publishRosterChanged("platoons");
    return NextResponse.json(snapshot);
  } catch (error) {
    return apiError(error);
  }
}
