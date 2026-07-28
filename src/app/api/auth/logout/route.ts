import { NextResponse } from "next/server";
import { destroySession, getAuthContext, isSecureSessionCookie, requireSameOrigin, sessionToken } from "@/server/auth";
import { runAuditedMutation } from "@/server/http";

export async function POST(request: Request) {
  const csrf = requireSameOrigin(request);
  if (csrf) return csrf;
  const context = await getAuthContext(request);
  const token = sessionToken(request);
  if (context) {
    await runAuditedMutation(context, "logout", () => destroySession(token));
  } else {
    await destroySession(token);
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set("rashod_session", "", { httpOnly: true, sameSite: "strict", secure: isSecureSessionCookie(), path: "/", maxAge: 0 });
  return response;
}
