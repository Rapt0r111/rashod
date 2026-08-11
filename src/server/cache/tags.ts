/**
 * Cache tags for stable (non-realtime) data only.
 * Live operational numbers (counts, locations, snapshots) must never use these tags.
 */
export const CACHE_TAGS = {
  /** Whether any users exist (setup gate). Invalidated when users are created. */
  hasUsers: "auth:has-users",
  /** Role catalog for admin UI. Invalidated on role mutations. */
  roles: "auth:roles",
} as const;

export type CacheTag = (typeof CACHE_TAGS)[keyof typeof CACHE_TAGS];
