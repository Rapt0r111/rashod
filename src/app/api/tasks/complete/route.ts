import { NextResponse } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/server/auth";
import { publishRosterChanged } from "@/server/events";
import { setPostgresTaskCompleted } from "@/server/db/postgres-tasks-repository";
import { apiError, parseJson, runAuditedMutation, uuidString } from "@/server/http";

const schema = z.object({ id: uuidString, completed: z.boolean() });

export async function POST(request: Request) {
  const auth = await requirePermission(request, "tasks:write");
  if (auth instanceof NextResponse) return auth;
  try {
    const input = await parseJson(request, schema);
    const snapshot = await runAuditedMutation(
      auth,
      "tasks.completed_changed",
      () => setPostgresTaskCompleted(input.id, input.completed),
      { id: input.id, completed: input.completed },
    );
    publishRosterChanged("tasks");
    return NextResponse.json(snapshot);
  } catch (error) {
    return apiError(error);
  }
}
