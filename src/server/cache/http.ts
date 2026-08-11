import { NextResponse } from "next/server";

/**
 * Live operational data (counts, people locations, snapshots, auth context).
 * Must never be stored by browsers, shared caches, or CDNs.
 */
export const LIVE_CACHE_CONTROL =
  "private, no-store, no-cache, max-age=0, must-revalidate";

/** Shared/CDN layers: never store live responses. */
export const LIVE_CDN_CACHE_CONTROL = "private, no-store";

/** SSE stream: disable intermediate buffering, keep private. */
export const SSE_CACHE_CONTROL = "private, no-cache, no-transform";

/**
 * Long-lived public static assets (content-hashed).
 * Prefer Next defaults for `/_next/static`; use when setting headers manually.
 */
export const STATIC_ASSET_CACHE_CONTROL =
  "public, max-age=31536000, immutable";

export function liveHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  headers.set("Cache-Control", LIVE_CACHE_CONTROL);
  headers.set("CDN-Cache-Control", LIVE_CDN_CACHE_CONTROL);
  headers.set("Vercel-CDN-Cache-Control", LIVE_CDN_CACHE_CONTROL);
  return headers;
}

export function sseHeaders(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  headers.set("Content-Type", "text/event-stream; charset=utf-8");
  headers.set("Cache-Control", SSE_CACHE_CONTROL);
  headers.set("CDN-Cache-Control", LIVE_CDN_CACHE_CONTROL);
  headers.set("Vercel-CDN-Cache-Control", LIVE_CDN_CACHE_CONTROL);
  headers.set("Connection", "keep-alive");
  return headers;
}

/** JSON response that must stay realtime-fresh (numeric KPIs, roster state). */
export function liveJson(
  data: unknown,
  init?: { status?: number; headers?: HeadersInit },
) {
  return NextResponse.json(data, {
    status: init?.status,
    headers: liveHeaders(init?.headers),
  });
}
