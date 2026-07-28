import { NextResponse } from "next/server";
import { z } from "zod";
import { PERMISSIONS, listRoles, requirePermission, saveRole } from "@/server/auth";
import { apiError, optionalText, parseJson, runAuditedMutation, shortText, uniqueArray, uuidString } from "@/server/http";

const roleSchema = z.object({ id: uuidString.optional(), key: z.string().trim().min(3).max(64), name: shortText(120), description: optionalText(500), permissions: uniqueArray(z.enum(PERMISSIONS), PERMISSIONS.length) });

export async function GET(request: Request) {
  const auth = await requirePermission(request, "roles:manage");
  if (auth instanceof NextResponse) return auth;
  if (!auth.permissions.includes("access:grant")) return NextResponse.json({ error: "ACCESS_GRANT_REQUIRED" }, { status: 403 });
  return NextResponse.json({ permissions: PERMISSIONS, roles: await listRoles() }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const auth = await requirePermission(request, "roles:manage");
  if (auth instanceof NextResponse) return auth;
  try {
    const input = await parseJson(request, roleSchema);
    const result = await runAuditedMutation(
      auth,
      "role.saved",
      async () => {
        const id = await saveRole(auth, input);
        return { id, roles: await listRoles() };
      },
      ({ id }) => ({ roleId: id }),
    );
    return NextResponse.json(result);
  } catch (error) {
    return apiError(error);
  }
}
