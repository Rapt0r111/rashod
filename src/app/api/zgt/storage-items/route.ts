import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/server/auth";
import {
  batchIssueStorageItems,
  batchReturnStorageItems,
  createStorageItem,
  listStorageItems,
  softDeleteStorageItem,
  updateStorageItem,
} from "@/server/db/postgres-zgt-storage-items-repository";
import { apiError, parseJson, runAuditedMutation } from "@/server/http";
import {
  StorageItemBatchIssueSchema,
  StorageItemBatchReturnSchema,
  StorageItemFormSchema,
  type StorageItemStatus,
  type StorageItemType,
} from "@/features/zgt/storage-items-types";
import { liveJson } from "@/server/cache/http";
import { publishRosterChanged } from "@/server/events";


export async function GET(request: Request) {
  const auth = await requirePermission(request, "zgt:read");
  if (auth instanceof NextResponse) return auth;
  const url = new URL(request.url);
  const result = await listStorageItems({
    q: url.searchParams.get("q") ?? undefined,
    status: (url.searchParams.get("status") as StorageItemStatus | "") || undefined,
    type: (url.searchParams.get("type") as StorageItemType | "") || undefined,
    page: Number(url.searchParams.get("page") ?? "1") || 1,
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
        z.object({ action: z.literal("create"), data: StorageItemFormSchema }),
        z.object({
          action: z.literal("update"),
          id: z.string().min(1).max(120),
          data: StorageItemFormSchema,
        }),
        z.object({ action: z.literal("delete"), id: z.string().min(1).max(120) }),
        z.object({
          action: z.literal("batch-issue"),
          data: StorageItemBatchIssueSchema,
        }),
        z.object({
          action: z.literal("batch-return"),
          data: StorageItemBatchReturnSchema,
        }),
      ]),
    );

    if (body.action === "create") {
      const item = await runAuditedMutation(
        auth,
        "zgt.storage_item.created",
        () => createStorageItem(body.data, auth.user.id),
        { type: body.data.type },
      );
      publishRosterChanged("zgt");
      return NextResponse.json({ item });
    }
    if (body.action === "update") {
      const item = await runAuditedMutation(
        auth,
        "zgt.storage_item.updated",
        () => updateStorageItem(body.id, body.data),
        { storageItemId: body.id },
      );
      publishRosterChanged("zgt");
      return NextResponse.json({ item });
    }
    if (body.action === "delete") {
      await runAuditedMutation(
        auth,
        "zgt.storage_item.deleted",
        () => softDeleteStorageItem(body.id),
        { storageItemId: body.id },
      );
      publishRosterChanged("zgt");
      return NextResponse.json({ ok: true });
    }
    if (body.action === "batch-issue") {
      const result = await runAuditedMutation(
        auth,
        "zgt.storage_item.batch_issue",
        () => batchIssueStorageItems(body.data),
        { count: body.data.ids.length },
      );
      publishRosterChanged("zgt");
      return NextResponse.json(result);
    }
    const result = await runAuditedMutation(
      auth,
      "zgt.storage_item.batch_return",
      () => batchReturnStorageItems(body.data),
      { count: body.data.ids.length },
    );
    publishRosterChanged("zgt");
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
