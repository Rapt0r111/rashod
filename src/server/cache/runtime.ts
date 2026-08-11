/**
 * Process-local tagged runtime cache (LAN / self-host friendly).
 *
 * Mirrors the Vercel Runtime Cache shape (get/set/delete/expireTag) without
 * requiring `@vercel/functions`. Data is ephemeral, per-process, and must
 * never store live operational numbers (people counts, locations, snapshots).
 *
 * Use for stable reference catalogs only; invalidate via expireTag on write.
 */

export type RuntimeCacheSetOptions = {
  /** Time-to-live in seconds. */
  ttl: number;
  tags?: string[];
  /** Observability label (unused locally; kept for API parity). */
  name?: string;
};

type Entry = {
  value: unknown;
  expiresAt: number;
  tags: string[];
};

const stores = new Map<string, Map<string, Entry>>();
const tagIndexes = new Map<string, Map<string, Set<string>>>();

function storeFor(namespace: string) {
  let map = stores.get(namespace);
  if (!map) {
    map = new Map();
    stores.set(namespace, map);
  }
  return map;
}

function tagIndexFor(namespace: string) {
  let map = tagIndexes.get(namespace);
  if (!map) {
    map = new Map();
    tagIndexes.set(namespace, map);
  }
  return map;
}

function indexTags(
  namespace: string,
  key: string,
  tags: string[],
) {
  const index = tagIndexFor(namespace);
  for (const tag of tags) {
    let keys = index.get(tag);
    if (!keys) {
      keys = new Set();
      index.set(tag, keys);
    }
    keys.add(key);
  }
}

function unindexKey(namespace: string, key: string, tags: string[]) {
  const index = tagIndexFor(namespace);
  for (const tag of tags) {
    const keys = index.get(tag);
    if (!keys) continue;
    keys.delete(key);
    if (!keys.size) index.delete(tag);
  }
}

export function getRuntimeCache(options?: { namespace?: string }) {
  const namespace = options?.namespace ?? "default";
  const store = storeFor(namespace);

  return {
    async get<T = unknown>(key: string): Promise<T | undefined> {
      const entry = store.get(key);
      if (!entry) return undefined;
      if (Date.now() >= entry.expiresAt) {
        unindexKey(namespace, key, entry.tags);
        store.delete(key);
        return undefined;
      }
      return entry.value as T;
    },

    async set(
      key: string,
      value: unknown,
      options: RuntimeCacheSetOptions,
    ): Promise<void> {
      const ttlMs = Math.max(0, Math.floor(options.ttl)) * 1000;
      const previous = store.get(key);
      if (previous) unindexKey(namespace, key, previous.tags);
      const tags = [...new Set(options.tags ?? [])];
      store.set(key, {
        value,
        expiresAt: Date.now() + ttlMs,
        tags,
      });
      indexTags(namespace, key, tags);
    },

    async delete(key: string): Promise<void> {
      const entry = store.get(key);
      if (!entry) return;
      unindexKey(namespace, key, entry.tags);
      store.delete(key);
    },

    async expireTag(tag: string | string[]): Promise<void> {
      const tags = Array.isArray(tag) ? tag : [tag];
      const index = tagIndexFor(namespace);
      for (const t of tags) {
        const keys = index.get(t);
        if (!keys) continue;
        for (const key of [...keys]) {
          const entry = store.get(key);
          if (entry) {
            unindexKey(namespace, key, entry.tags);
            store.delete(key);
          }
        }
        index.delete(t);
      }
    },
  };
}

/** Test helper: clear all namespaces. */
export function clearAllRuntimeCaches() {
  stores.clear();
  tagIndexes.clear();
}
