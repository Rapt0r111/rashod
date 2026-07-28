import { NextResponse } from "next/server";
import { z } from "zod";
import { authenticate, checkLoginRateLimit, createSession, recordAuditEvent, recordLoginAttempt, requireSameOrigin, sessionCookie } from "@/server/auth";
import { inPostgresTransaction } from "@/server/db/postgres";
import { apiError, parseJson } from "@/server/http";

export const dynamic = "force-dynamic";

const loginSchema = z.object({ username: z.string().trim().min(3).max(64), password: z.string().min(1).max(256) });

export async function POST(request: Request) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;
  let input: z.infer<typeof loginSchema>;
  try {
    input = await parseJson(request, loginSchema);
  } catch (error) {
    return apiError(error);
  }
  if (!(await checkLoginRateLimit(input.username, request))) return NextResponse.json({ error: "LOGIN_TEMPORARILY_BLOCKED" }, { status: 429 });
  const user = await authenticate(input.username, input.password);
  if (!user) {
    await inPostgresTransaction(async () => {
      await recordLoginAttempt(input.username, request, false);
      await recordAuditEvent({ action: "login.failed", metadata: { username: input.username.trim().toLocaleLowerCase("ru-RU") } });
    });
    return NextResponse.json({ error: "INVALID_CREDENTIALS" }, { status: 401 });
  }
  const token = await inPostgresTransaction(async () => {
    await recordLoginAttempt(input.username, request, true);
    await recordAuditEvent({ action: "login.succeeded", actorUserId: user.id });
    return createSession(user.id);
  });
  const response = NextResponse.json({ user: { username: user.username, displayName: user.displayName } });
  const cookie = sessionCookie(token);
  response.cookies.set(cookie.name, cookie.value, cookie.options);
  return response;
}
