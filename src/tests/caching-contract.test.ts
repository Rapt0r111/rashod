import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  clearAllRuntimeCaches,
  getRuntimeCache,
} from "@/server/cache/runtime";
import {
  LIVE_CACHE_CONTROL,
  LIVE_CDN_CACHE_CONTROL,
  liveHeaders,
  liveJson,
  sseHeaders,
} from "@/server/cache/http";
import { CACHE_TAGS } from "@/server/cache/tags";

const read = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("caching contracts", () => {
  it("enables Cache Components (PPR) in next.config", () => {
    const config = read("next.config.ts");
    expect(config).toContain("cacheComponents: true");
  });

  it("keeps portal/zgt under a shared shell; roster is a separate surface", () => {
    const shellLayout = read("src/app/(modules)/layout.tsx");
    expect(shellLayout).toContain("PortalShell");
    expect(shellLayout).toContain("getRequestAuth");

    const home = read("src/app/page.tsx");
    expect(home).toContain("getRequestAuth");
    expect(home).toContain("WorkspaceApp");
    expect(home).not.toContain('dynamic = "force-dynamic"');

    for (const path of [
      "src/app/(modules)/portal/page.tsx",
      "src/app/(modules)/zgt/page.tsx",
      "src/app/(modules)/zgt/equipment/page.tsx",
      "src/app/(modules)/zgt/phones/page.tsx",
      "src/app/(modules)/zgt/storage-items/page.tsx",
    ]) {
      const page = read(path);
      expect(page).toContain("PortalContentFallback");
      expect(page).toContain("getRequestAuth");
      expect(page).not.toContain('dynamic = "force-dynamic"');
    }
  });

  it("portal shell does not branch DOM on pathname (avoids hydration mismatch)", () => {
    const chrome = read("src/features/portal/PortalChrome.tsx");
    expect(chrome).toContain("PortalShellContext");
    expect(chrome).toContain("if (nested) return");
    expect(chrome).toContain('data-portal-shell=""');
    expect(chrome).toContain("w-full min-w-0 flex-1 overflow-y-auto overscroll-contain px-3 py-4");
    expect(chrome).not.toContain("max-w-5xl");
    expect(chrome).not.toContain("mx-auto w-full px-5");
    expect(chrome).toContain("<RealtimeProvider>{children}</RealtimeProvider>");
    expect(chrome).not.toContain("<RealtimeProvider>\n        <PortalShellFrame");
    expect(chrome).not.toContain("fullBleed");
    expect(chrome).not.toContain("chrome: false");
    const globals = read("src/app/globals.css");
    expect(globals).toContain("[data-portal-shell] [data-portal-shell]");
    expect(globals).toContain("display: contents");
  });

  it("does not force a global loading.tsx spinner on every route change", () => {
    expect(existsSync(resolve(process.cwd(), "src/app/loading.tsx"))).toBe(false);
    const fallback = read("src/components/page-fallback.tsx");
    // Soft shell only — no spinner component import or usage.
    expect(fallback).not.toMatch(/from ["']@\/components\/loader["']/);
    expect(fallback).not.toMatch(/<Loader\b/);
    expect(fallback).toContain("min-h-dvh");
  });

  it("keeps live operational snapshot path uncached on server pages", () => {
    const home = read("src/app/page.tsx");
    const refs = read("src/app/references/page.tsx");
    expect(home).toContain("getSnapshot");
    expect(home).not.toContain("use cache");
    expect(refs).toContain("getPostgresSnapshot");
    expect(refs).not.toMatch(/['"]use cache['"]/);
  });

  it("marks snapshot and events APIs as live / no shared cache", () => {
    const snapshot = read("src/app/api/snapshot/route.ts");
    const events = read("src/app/api/events/route.ts");
    expect(snapshot).toContain("liveJson");
    expect(events).toContain("sseHeaders");
    expect(snapshot).not.toContain("use cache");
  });

  it("client data layer forces no-store for live numbers", () => {
    const api = read("src/lib/api-client.ts");
    expect(api).toContain('cache: "no-store"');
  });

  it("service worker never caches API or HTML navigations", () => {
    const sw = read("public/sw.js");
    expect(sw).toContain('url.pathname.startsWith("/api/")');
    expect(sw).toContain('request.mode === "navigate"');
    expect(sw).toContain("STATIC_CACHE");
  });

  it("liveJson sets private no-store for browser and CDN", () => {
    const headers = liveHeaders();
    expect(headers.get("Cache-Control")).toBe(LIVE_CACHE_CONTROL);
    expect(headers.get("CDN-Cache-Control")).toBe(LIVE_CDN_CACHE_CONTROL);
    expect(headers.get("Vercel-CDN-Cache-Control")).toBe(LIVE_CDN_CACHE_CONTROL);

    const response = liveJson({ total: 42 });
    expect(response.headers.get("Cache-Control")).toBe(LIVE_CACHE_CONTROL);
  });

  it("sseHeaders keep streams unbuffered and private", () => {
    const headers = sseHeaders();
    expect(headers.get("Content-Type")).toContain("text/event-stream");
    expect(headers.get("Cache-Control")).toContain("no-cache");
    expect(headers.get("CDN-Cache-Control")).toBe(LIVE_CDN_CACHE_CONTROL);
  });

  it("stable cache tags are only for non-numeric catalogs", () => {
    expect(CACHE_TAGS.hasUsers).toBe("auth:has-users");
    expect(CACHE_TAGS.roles).toBe("auth:roles");
    expect(Object.values(CACHE_TAGS).join(" ")).not.toMatch(/snapshot|people|count/i);
  });
});

describe("runtime cache", () => {
  beforeEach(() => {
    clearAllRuntimeCaches();
  });
  afterEach(() => {
    clearAllRuntimeCaches();
  });

  it("stores and retrieves values with TTL", async () => {
    const cache = getRuntimeCache({ namespace: "test" });
    await cache.set("k", { n: 1 }, { ttl: 60, tags: ["t1"] });
    await expect(cache.get("k")).resolves.toEqual({ n: 1 });
  });

  it("expires all keys for a tag without affecting others", async () => {
    const cache = getRuntimeCache({ namespace: "test" });
    await cache.set("a", 1, { ttl: 60, tags: ["roles"] });
    await cache.set("b", 2, { ttl: 60, tags: ["other"] });
    await cache.expireTag("roles");
    await expect(cache.get("a")).resolves.toBeUndefined();
    await expect(cache.get("b")).resolves.toBe(2);
  });

  it("deletes a single key", async () => {
    const cache = getRuntimeCache({ namespace: "test" });
    await cache.set("x", "y", { ttl: 60 });
    await cache.delete("x");
    await expect(cache.get("x")).resolves.toBeUndefined();
  });
});
