import { NextResponse } from "next/server";
import { z } from "zod";
import { assertCanGrantRoles, assertCanManageUser, createUser, listUsers, requirePermission, updateUser } from "@/server/auth";
import { apiError, idString, parseJson, runAuditedMutation, shortText, uniqueArray, uuidString } from "@/server/http";
import { liveJson } from "@/server/cache/http";

const roleIdsSchema = uniqueArray(idString, 32).refine((items) => items.length > 0, "ROLE_REQUIRED");
const createSchema = z.object({ username: z.string().trim().min(3).max(64), password: z.string().min(12).max(256), displayName: shortText(160), roleIds: roleIdsSchema });
const updateSchema = z.object({ id: uuidString, displayName: shortText(160).optional(), active: z.boolean().optional(), password: z.string().min(12).max(256).optional(), roleIds: roleIdsSchema.optional() });

export async function GET(request: Request) {
  const auth = await requirePermission(request, "users:manage");
  if (auth instanceof NextResponse) return auth;
  return liveJson({ users: await listUsers() });
}

export async function POST(request: Request) {
  const auth = await requirePermission(request, "users:manage");
  if (auth instanceof NextResponse) return auth;
  try {
    const input = await parseJson(request, createSchema);
    await assertCanGrantRoles(auth, input.roleIds);
    const result = await runAuditedMutation(
      auth,
      "user.created",
      async () => {
        const id = await createUser(input);
        return { id, users: await listUsers() };
      },
      { roleIds: input.roleIds },
      ({ id }) => id,
    );
    return liveJson(result, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}

export async function PUT(request: Request) {
  const auth = await requirePermission(request, "users:manage");
  if (auth instanceof NextResponse) return auth;
  try {
    const input = await parseJson(request, updateSchema);
    const securityChange = input.active !== undefined || input.password !== undefined || input.roleIds !== undefined;
    await assertCanManageUser(auth, input.id, securityChange);
    if (input.roleIds) await assertCanGrantRoles(auth, input.roleIds);
    const result = await runAuditedMutation(
      auth,
      "user.updated",
      async () => {
        await updateUser(input);
        return { users: await listUsers() };
      },
      { active: input.active, changedPassword: input.password !== undefined, changedRoles: input.roleIds !== undefined },
      input.id,
    );
    return liveJson(result);
  } catch (error) {
    return apiError(error);
  }
}
