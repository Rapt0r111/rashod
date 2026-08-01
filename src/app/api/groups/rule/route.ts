import { NextResponse } from "next/server";
import { z } from "zod";
import { updatePostgresDutyGroupRule as updateDutyGroupRule } from "@/server/db/postgres-groups-repository";
import { publishRosterChanged } from "@/server/events";
import { requirePermission } from "@/server/auth";
import { apiError, idString, parseJson, runAuditedMutation, uniqueArray } from "@/server/http";

export const dynamic = "force-dynamic";

const schema = z.object({
  groupId: idString,
  expectedUpdatedAt: z.number().int().nonnegative().optional(),
  enabledPlatoons: uniqueArray(idString, 64).optional(),
  peoplePerDay: z.number().int().min(1).max(2560).optional(),
  assignmentQuotas: z.array(z.object({ platoonId: idString, count: z.number().int().min(1).max(40) })).max(64).refine(
    (items) => new Set(items.map((item) => item.platoonId)).size === items.length,
  ).optional(),
  autoRotate: z.boolean().optional(),
  activeDays: uniqueArray(z.number().int().min(0).max(6), 7).optional(),
  priorityMode: z.enum(["oldest", "random"]).optional(),
  overlapPolicy: z.enum(["exclusive", "manual"]).optional(),
  confirmOverlapCleanup: z.boolean().optional(),
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
    const maybeCleanup = error as Error & { cleanupCount?: number; conflicts?: unknown };
    return apiError(error, {
      status: maybeCleanup.message === "GROUP_OVERLAP_CLEANUP_REQUIRED" ? 409 : undefined,
      extra: maybeCleanup.message === "GROUP_OVERLAP_CLEANUP_REQUIRED"
        ? { cleanupCount: maybeCleanup.cleanupCount ?? 0, conflicts: maybeCleanup.conflicts ?? [] }
        : undefined,
    });
  }
}
