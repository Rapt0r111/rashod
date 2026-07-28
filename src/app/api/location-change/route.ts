import { NextResponse } from "next/server";
import { z } from "zod";
import {
  changePostgresPersonLocation as changePersonLocation,
  getPostgresPeopleByIds as getPeopleByIds,
  getPostgresSnapshot as getSnapshot,
  undoPostgresLocations as undoLocations,
} from "@/server/db/postgres-roster-repository";
import { publishRosterChanged } from "@/server/events";
import { requirePermission } from "@/server/auth";
import { apiError, idString, parseJson, runAuditedMutation, shortText, uniqueArray, uniqueArrayBy } from "@/server/http";

const changeSchema = z.object({
  personId: idString,
  to: shortText(120),
});
const undoSchema = z.object({
  undo: uniqueArrayBy(
    z.object({ personId: idString, location: shortText(120) }),
    (item) => item.personId,
    200,
  ),
});
const idsSchema = z.object({ ids: uniqueArray(idString, 500).default([]) });

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const auth = await requirePermission(request, "roster:write");
  if (auth instanceof NextResponse) return auth;
  try {
    const body = await parseJson(request, z.union([undoSchema, changeSchema]));
    if ("undo" in body) {
      const parsed = undoSchema.parse(body);
      const snapshot = await runAuditedMutation(
        auth,
        "roster.location.undo",
        async () => {
          await undoLocations(parsed.undo);
          return getSnapshot();
        },
        { count: parsed.undo.length },
      );
      publishRosterChanged("undo");
      return NextResponse.json(snapshot);
    }
    const parsed = changeSchema.parse(body);
    const snapshot = await runAuditedMutation(
      auth,
      "roster.location.changed",
      async () => {
        const changed = await changePersonLocation(parsed.personId, parsed.to);
        return { ...(await getSnapshot()), changed };
      },
      { personId: parsed.personId, to: parsed.to },
    );
    publishRosterChanged("location-change");
    return NextResponse.json(snapshot);
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  const auth = await requirePermission(request, "roster:read");
  if (auth instanceof NextResponse) return auth;
  try {
    const { ids } = await parseJson(request, idsSchema);
    return NextResponse.json({ people: await getPeopleByIds(ids) });
  } catch (error) {
    return apiError(error);
  }
}
