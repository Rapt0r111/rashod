import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/server/auth";
import {
  batchCheckInPhones,
  batchCheckOutPhones,
  createPhone,
  listPhones,
  softDeletePhone,
  updatePhone,
} from "@/server/db/postgres-zgt-phones-repository";
import { apiError, parseJson, runAuditedMutation } from "@/server/http";
import {
  PhoneBatchSchema,
  PhoneFormSchema,
  type PhoneStatus,
} from "@/features/zgt/phones-types";
import { liveJson } from "@/server/cache/http";
import { publishRosterChanged } from "@/server/events";


export async function GET(request: Request) {
  const auth = await requirePermission(request, "zgt:read");
  if (auth instanceof NextResponse) return auth;
  const url = new URL(request.url);
  const result = await listPhones({
    q: url.searchParams.get("q") ?? undefined,
    status: (url.searchParams.get("status") as PhoneStatus | "") || undefined,
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
        z.object({ action: z.literal("create"), data: PhoneFormSchema }),
        z.object({
          action: z.literal("update"),
          id: z.string().min(1).max(120),
          data: PhoneFormSchema,
        }),
        z.object({ action: z.literal("delete"), id: z.string().min(1).max(120) }),
        z.object({ action: z.literal("batch-check-in"), data: PhoneBatchSchema }),
        z.object({
          action: z.literal("batch-check-out"),
          data: z.object({
            ids: z.array(z.string().trim().min(1).max(120)).min(1).max(500),
          }),
        }),
      ]),
    );

    if (body.action === "create") {
      const item = await runAuditedMutation(
        auth,
        "zgt.phone.created",
        () => createPhone(body.data, auth.user.id),
        { personId: body.data.personId },
      );
      publishRosterChanged("zgt");
      return NextResponse.json({ item });
    }
    if (body.action === "update") {
      const item = await runAuditedMutation(
        auth,
        "zgt.phone.updated",
        () => updatePhone(body.id, body.data),
        { phoneId: body.id },
      );
      publishRosterChanged("zgt");
      return NextResponse.json({ item });
    }
    if (body.action === "delete") {
      await runAuditedMutation(
        auth,
        "zgt.phone.deleted",
        () => softDeletePhone(body.id),
        { phoneId: body.id },
      );
      publishRosterChanged("zgt");
      return NextResponse.json({ ok: true });
    }
    if (body.action === "batch-check-in") {
      const result = await runAuditedMutation(
        auth,
        "zgt.phone.batch_check_in",
        () => batchCheckInPhones(body.data),
        { count: body.data.ids.length },
      );
      publishRosterChanged("zgt");
      return NextResponse.json(result);
    }
    const result = await runAuditedMutation(
      auth,
      "zgt.phone.batch_check_out",
      () => batchCheckOutPhones(body.data),
      { count: body.data.ids.length },
    );
    publishRosterChanged("zgt");
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
