import { cacheLife, cacheTag, revalidateTag } from "next/cache";
import {
  hasUsers as hasUsersUncached,
  listRoles as listRolesUncached,
} from "@/server/auth";
import { CACHE_TAGS } from "@/server/cache/tags";
import { getRuntimeCache } from "@/server/cache/runtime";

const runtime = getRuntimeCache({ namespace: "stable" });

/**
 * Setup gate: rarely changes (once first admin exists).
 * Safe to cache — not a live operational metric.
 */
export async function getCachedHasUsers(): Promise<boolean> {
  "use cache";
  cacheTag(CACHE_TAGS.hasUsers);
  cacheLife("hours");
  return hasUsersUncached();
}

/**
 * Role catalog for admin screens. Invalidated on role save.
 * Not live counts — structural permission metadata only.
 *
 * Uses Next `use cache` (cross-request) plus process-local runtime cache
 * for same-instance hits without re-entering the data cache layer.
 */
export async function getCachedRoles() {
  "use cache";
  cacheTag(CACHE_TAGS.roles);
  cacheLife("hours");
  return listRolesUncached();
}

/**
 * Process-local role catalog for route handlers that prefer runtime cache
 * without requiring the full `use cache` path (e.g. after tag invalidation).
 */
export async function getRuntimeCachedRoles() {
  const hit = await runtime.get<Awaited<ReturnType<typeof listRolesUncached>>>(
    "roles",
  );
  if (hit) return hit;
  const roles = await listRolesUncached();
  await runtime.set("roles", roles, {
    ttl: 3600,
    tags: [CACHE_TAGS.roles],
    name: "auth-roles",
  });
  return roles;
}

/** Call after user creation so the setup gate refreshes. */
export function invalidateHasUsersCache() {
  try {
    revalidateTag(CACHE_TAGS.hasUsers, "max");
  } catch {
    // Outside Next request lifecycle (CLI create-admin, unit tests).
  }
}

/** Call after role mutations so admin UI sees updated catalogs. */
export async function invalidateRolesCache() {
  try {
    revalidateTag(CACHE_TAGS.roles, "max");
  } catch {
    // Outside Next request lifecycle.
  }
  await runtime.expireTag(CACHE_TAGS.roles);
}
