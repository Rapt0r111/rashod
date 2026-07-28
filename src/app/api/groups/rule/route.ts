import { NextResponse } from "next/server";
import { z } from "zod";
import { updatePostgresDutyGroupRule as updateDutyGroupRule } from "@/server/db/postgres-groups-repository";
import { publishRosterChanged } from "@/server/events";
import { requirePermission } from "@/server/auth";
import { apiError, idString, parseJson, runAuditedMutation, uniqueArray } from "@/server/http";

export const dynamic = "force-dynamic";

const schema = z.object({
  groupId: idString,
  enabledPlatoons: uniqueArray(idString, 64).optional(),
  peoplePerDay: z.number().int().min(1).max(40).optional(),
  autoRotate: z.boolean().optional(),
  activeDays: uniqueArray(z.number().int().min(0).max(6), 7).optional(),
  priorityMode: z.enum(["oldest", "random"]).optional(),
});

export async function PUT(request: Request) {
  const auth = await requirePermission(request, "groups:write");
  if (auth instanceof NextResponse) return auth;
  try {
    const input = await parseJson(request, schema);
    const snapshot = await runAuditedMutation(
      auth,
      "groups.rule.updated",
      () => updateDutyGroupRule(input),
      { groupId: input.groupId },
    );
    publishRosterChanged("groups");
    return NextResponse.json(snapshot);
  } catch (error) {
    return apiError(error);
  }
}
