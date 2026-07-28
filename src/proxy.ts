import { NextResponse, type NextRequest } from "next/server";

/**
 * Deliberately only a coarse edge layer. Route handlers and Server Components
 * remain the source of truth for sessions and resource-level authorization.
 */
export function proxy(request: NextRequest) {
  void request;
  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set("Permissions-Policy", "camera=(), geolocation=(), microphone=(), payment=(), usb=()");

  if (process.env.NODE_ENV === "production") {
    response.headers.set("Content-Security-Policy", "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'");
    if (process.env.AUTH_ENABLE_HSTS === "true") response.headers.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js).*)"],
};
