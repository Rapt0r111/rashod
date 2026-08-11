import { NextResponse, type NextRequest } from "next/server";
import { STATIC_ASSET_CACHE_CONTROL } from "@/server/cache/http";

/**
 * Deliberately only a coarse edge layer. Route handlers and Server Components
 * remain the source of truth for sessions and resource-level authorization.
 *
 * Cache policy:
 * - Static hashed assets may be cached long-term at the edge.
 * - Application pages and `/api/*` are never edge-cached here (private/live).
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Frame-Options", "DENY");
  response.headers.set("Referrer-Policy", "no-referrer");
  response.headers.set(
    "Permissions-Policy",
    "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  );

  // Content-hashed build assets + public fonts: safe for shared caches.
  if (
    pathname.startsWith("/_next/static/") ||
    pathname.startsWith("/fonts/") ||
    /\.(?:woff2|css|js|map|svg|png|ico|webp|jpg|jpeg|gif)$/i.test(pathname)
  ) {
    // Prefer Next's built-in headers for /_next/static; reinforce for public/*.
    if (!pathname.startsWith("/_next/")) {
      response.headers.set("Cache-Control", STATIC_ASSET_CACHE_CONTROL);
      response.headers.set("CDN-Cache-Control", STATIC_ASSET_CACHE_CONTROL);
    }
  }

  if (process.env.NODE_ENV === "production") {
    response.headers.set(
      "Content-Security-Policy",
      "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'",
    );
    if (process.env.AUTH_ENABLE_HSTS === "true") {
      response.headers.set(
        "Strict-Transport-Security",
        "max-age=31536000; includeSubDomains",
      );
    }
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sw.js).*)"],
};
