import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/server/auth";
import { publishRosterChanged } from "@/server/events";
import { createPostgresTask, getPostgresTasksSnapshot, updatePostgresTask } from "@/server/db/postgres-tasks-repository";
import { apiError, optionalText, parseJson, runAuditedMutation, shortText, uuidString } from "@/server/http";
import { liveJson } from "@/server/cache/http";


const createSchema = z.object({ title: shortText(240), description: optionalText(2_000), parentId: uuidString.nullable().optional() });
const updateSchema = z.object({ id: uuidString, title: shortText(240).optional(), description: optionalText(2_000) });

export async function GET(request: Request) {
  const auth = await requirePermission(request, "tasks:read");
  if (auth instanceof NextResponse) return auth;
  return liveJson(await getPostgresTasksSnapshot());
}

export async function POST(request: Request) {
  const auth = await requirePermission(request, "tasks:write");
  if (auth instanceof NextResponse) return auth;
  try {
    const input = await parseJson(request, createSchema);
    const snapshot = await runAuditedMutation(
      auth,
      "tasks.created",
      () => createPostgresTask(input),
      { parentId: input.parentId ?? null },
    );
    publishRosterChanged("tasks");
    return NextResponse.json(snapshot);
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  const auth = await requirePermission(request, "tasks:write");
  if (auth instanceof NextResponse) return auth;
  try {
    const input = await parseJson(request, updateSchema);
    const snapshot = await runAuditedMutation(
      auth,
      "tasks.updated",
      () => updatePostgresTask(input),
      { id: input.id },
    );
    publishRosterChanged("tasks");
    return NextResponse.json(snapshot);
  } catch (error) {
    return apiError(error);
  }
}
