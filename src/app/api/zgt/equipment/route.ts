import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/server/auth";
import {
  batchIssueEquipment,
  batchMoveEquipment,
  batchReturnEquipment,
  createEquipment,
  listEquipment,
  softDeleteEquipment,
  updateEquipment,
} from "@/server/db/postgres-zgt-repository";
import {
  apiError,
  parseJson,
  runAuditedMutation,
} from "@/server/http";
import {
  BatchIssueSchema,
  BatchMoveSchema,
  BatchReturnSchema,
  EquipmentFormSchema,
  type EquipmentStatus,
} from "@/features/zgt/types";
import { liveJson } from "@/server/cache/http";
import { publishRosterChanged } from "@/server/events";


export async function GET(request: Request) {
  const auth = await requirePermission(request, "zgt:read");
  if (auth instanceof NextResponse) return auth;

  const url = new URL(request.url);
  const result = await listEquipment({
    q: url.searchParams.get("q") ?? undefined,
    status: (url.searchParams.get("status") as EquipmentStatus | "") || undefined,
    category: url.searchParams.get("category") ?? undefined,
    location: url.searchParams.get("location") ?? undefined,
    page: Number(url.searchParams.get("page") ?? "1") || 1,
    sortBy: url.searchParams.get("sortBy") ?? undefined,
    sortDir: (url.searchParams.get("sortDir") as "asc" | "desc" | null) ?? undefined,
  });
  return liveJson(result);
}

export async function POST(request: Request) {
  const auth = await requirePermission(request, "zgt:write");
  if (auth instanceof NextResponse) return auth;

  try {
    const body = await parseJson(
      request,
      z.discriminatedUnion("action", [
        z.object({ action: z.literal("create"), data: EquipmentFormSchema }),
        z.object({ action: z.literal("update"), id: z.string().min(1).max(120), data: EquipmentFormSchema }),
        z.object({ action: z.literal("delete"), id: z.string().min(1).max(120) }),
        z.object({ action: z.literal("batch-issue"), data: BatchIssueSchema }),
        z.object({ action: z.literal("batch-return"), data: BatchReturnSchema }),
        z.object({ action: z.literal("batch-move"), data: BatchMoveSchema }),
      ]),
    );

    if (body.action === "create") {
      const item = await runAuditedMutation(
        auth,
        "zgt.equipment.created",
        () => createEquipment(body.data, auth.user.id),
        { displayName: body.data.displayName },
      );
      publishRosterChanged("zgt");
      return NextResponse.json({ item });
    }

    if (body.action === "update") {
      const item = await runAuditedMutation(
        auth,
        "zgt.equipment.updated",
        () => updateEquipment(body.id, body.data),
        { equipmentId: body.id },
      );
      publishRosterChanged("zgt");
      return NextResponse.json({ item });
    }

    if (body.action === "delete") {
      await runAuditedMutation(
        auth,
        "zgt.equipment.deleted",
        () => softDeleteEquipment(body.id),
        { equipmentId: body.id },
      );
      publishRosterChanged("zgt");
      return NextResponse.json({ ok: true });
    }

    if (body.action === "batch-issue") {
      const result = await runAuditedMutation(
        auth,
        "zgt.equipment.batch_issue",
        () =>
          batchIssueEquipment({
            ...body.data,
            toPersonId: body.data.toPersonId ?? null,
            createdBy: auth.user.id,
          }),
        { count: body.data.ids.length },
      );
      publishRosterChanged("zgt");
      return NextResponse.json(result);
    }

    if (body.action === "batch-return") {
      const result = await runAuditedMutation(
        auth,
        "zgt.equipment.batch_return",
        () =>
          batchReturnEquipment({
            ...body.data,
            createdBy: auth.user.id,
          }),
        { count: body.data.ids.length },
      );
      publishRosterChanged("zgt");
      return NextResponse.json(result);
    }

    const result = await runAuditedMutation(
      auth,
      "zgt.equipment.batch_move",
      () =>
        batchMoveEquipment({
          ...body.data,
          createdBy: auth.user.id,
        }),
      { count: body.data.ids.length },
    );
    publishRosterChanged("zgt");
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
