/**
 * Service worker: cache static shell assets only.
 * Never cache /api/* or HTML app shells — live numbers must stay fresh via
 * network + SSE (/api/events) + client snapshot refresh.
 */
const STATIC_CACHE = "rashod-static-v1";
const STATIC_PATH_RE =
  /\/_next\/static\/|\/fonts\/|\.(?:woff2|css|js|map|svg|png|ico|webp)$/i;

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE)
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // Never intercept API, SSE, or navigations — realtime + auth stay on network.
  if (url.pathname.startsWith("/api/")) return;
  if (request.mode === "navigate" || request.headers.get("accept")?.includes("text/html")) {
    return;
  }

  if (!STATIC_PATH_RE.test(url.pathname)) return;

  event.respondWith(
    (async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(request);
      if (cached) return cached;
      const response = await fetch(request);
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })(),
  );
});
